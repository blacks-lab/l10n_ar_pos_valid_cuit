/** @odoo-module **/
import {ErrorPopup} from "@point_of_sale/app/errors/popups/error_popup";
import {PartnerDetailsEdit} from "@point_of_sale/app/screens/partner_list/partner_editor/partner_editor";
import {_t} from "@web/core/l10n/translation";
import {patch} from "@web/core/utils/patch";
import {useService} from "@web/core/utils/hooks";

patch(PartnerDetailsEdit.prototype, {
    setup() {
        super.setup(...arguments);
        this.popup = useService("popup");
        this.changes.vat = this.props.partner.vat;
    },
    saveChanges() {
        // Simple debounce/lock to prevent double submit: set a short timeout
        if (this._saving) {
            return;
        }
        this._saving = true;
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }
        // auto-unlock after 3s in case something unexpected happens
        this._saveTimeout = setTimeout(() => {
            this._saving = false;
            this._saveTimeout = null;
        }, 3000);
        // ------------------------------------------------------------
        // IDENTIFICATION-TYPE BASED CASE
        // Solo ejecutar la validación CUIT/CUIL cuando el tipo de
        // identificación seleccionado corresponda a CUIT o CUIL.
        // Para otros tipos (DNI, LC, LE, PAS, etc.) se mostrará un
        // aviso informativo y se continuará con el guardado sin la
        // validación de dígito verificador.
        // ------------------------------------------------------------

        const validatePadronA5 = this.pos.config && this.pos.config.validate_padron_a5;

        // debug logs removed for production

        // Detectar el tipo de identificación usando claves comunes
        const partner = this.props.partner || {};
        const candidateKeys = [
            'l10n_latam_identification_type_id',
            'identification_id',
            'identification_type_id',
            'document_type',
            'vat_type',
        ];

        const detectIdTypeName = () => {
            // Helper: try to resolve a primitive id (string/number) using this.pos lists or partner
            const resolveIdToName = (id) => {
                if (id === null || id === undefined) return null;
                const idStr = String(id);
                // Only try partner mappings (tupla [id,name] or object) to avoid false matches
                for (const key of candidateKeys) {
                    if (!partner.hasOwnProperty(key)) continue;
                    const val = partner[key];
                    if (!val) continue;
                    if (Array.isArray(val) && String(val[0]) === idStr && val[1]) return String(val[1]);
                    if (val && typeof val === 'object' && (String(val.id) === idStr) && (val.display_name || val.name)) return String(val.display_name || val.name);
                }
                return null;
            };

            // 1) Preferir cambios locales del editor si existen (buscar any candidateKey en this.changes)
            if (this.changes) {
                for (const key of candidateKeys) {
                    if (!this.changes.hasOwnProperty(key)) continue;
                    const v = this.changes[key];
                    if (!v && v !== 0) continue;
                    if (Array.isArray(v) && v.length >= 2 && v[1]) return String(v[1]);
                    if (v && typeof v === 'object' && (v.display_name || v.name)) return String(v.display_name || v.name);
                    // primitive id -> try resolve
                    if (typeof v === 'string' || typeof v === 'number') {
                        const resolved = resolveIdToName(v);
                        if (resolved) {
                            return resolved;
                        }
                        return String(v);
                    }
                }
            }

            // 2) Inspeccionar candidateKeys en partner (valor traído desde backend)
                for (const key of candidateKeys) {
                if (partner.hasOwnProperty(key) && partner[key]) {
                    const val = partner[key];
                    if (Array.isArray(val) && val.length >= 2 && val[1]) return String(val[1]);
                    if (val && typeof val === 'object' && (val.display_name || val.name)) return String(val.display_name || val.name);
                    if (typeof val === 'string' && val.trim()) return val.trim();
                }
            }

            return null;
        };

        const idTypeName = detectIdTypeName();
    let idNorm = idTypeName ? idTypeName.trim().toUpperCase() : '';

        // Mapear tipos a acciones (case)
        const CUIT_TYPES = new Set(['CUIT', 'CUIL']);
        const DNI_TYPES = new Set(['DNI', 'D.N.I', 'DOCUMENTO', 'DOC']);
        const OTHER_TYPES = new Set(['LC', 'LE', 'PAS', 'PASAPORTE']);

        // Extraer la lógica del case en una función para poder reutilizarla
        const runCase = (resolvedName) => {
            const name = resolvedName || idTypeName;
            const norm = name ? String(name).trim().toUpperCase() : '';

            // Si es CUIT/CUIL, ejecutar la validación que ya existía (sin mostrar popups informativos extra)
            if (CUIT_TYPES.has(norm)) {
                if (!this.changes.vat) {
                    return this.popup.add(ErrorPopup, {
                        title: _t('Información Faltante'),
                        body: _t('El CUIT/CUIL es obligatorio'),
                    });
                }

                const vatValue = this.changes.vat;
                // Devolver la promesa encadenada para evitar continuar con el fallback
                return this.pos.orm.call('res.partner', 'normalize_cuit', [vatValue]).then((vatNorm) => {
                    const vatToCheck = vatNorm || vatValue;
                    return this.pos.orm.call('res.partner', 'cuit_check', [vatToCheck]).then((ok) => {
                        if (ok === true) {
                            if (validatePadronA5) {
                                this.popup.add(ErrorPopup, {
                                    title: _t('Validación Padrón A5'),
                                    body: _t('La validación con Padrón A5 está en desarrollo.\nEl CUIT/CUIL es válido y se guardará normalmente.'),
                                });
                                setTimeout(() => this.finalizeSave(), 2000);
                            } else {
                                this.finalizeSave();
                            }
                            return;
                        }
                        // Si no es válido, solicitar mensajes y mostrar un único popup
                        return this.pos.orm.call('res.partner', 'get_cuit_validation_messages', [vatToCheck]).then((validation_result) => {
                            const msgs = validation_result && validation_result.messages ? validation_result.messages : [_t('CUIT/CUIL inválido')];
                            this.popup.add(ErrorPopup, {
                                title: _t('CUIT/CUIL Inválido'),
                                body: msgs.join('\n'),
                            });
                        }).catch((err) => {
                            try { console.error('[l10n_ar_pos_valid_cuit] get_cuit_validation_messages error', err); } catch (e) {}
                            const serverMsg = (err && err.data && (err.data.message || err.data.exception_message)) || (err && err.message);
                            this.popup.add(ErrorPopup, {
                                title: _t('Comprobación de CUIT/CUIL'),
                                body: serverMsg ? serverMsg : _t('CUIT/CUIL inválido'),
                            });
                            if (this._saveTimeout) { clearTimeout(this._saveTimeout); this._saveTimeout = null; }
                            this._saving = false;
                        });
                    });
                }).catch((err) => {
                    try { console.error('[l10n_ar_pos_valid_cuit] normalize_cuit/cuit_check error', err); } catch (e) {}
                    const serverMsg = (err && err.data && (err.data.message || err.data.exception_message)) || (err && err.message);
                    this.popup.add(ErrorPopup, {
                        title: _t('Error servidor'),
                        body: serverMsg ? `${_t('Ocurrió un error al validar el CUIT/CUIL')}: ${serverMsg}` : _t('Ocurrió un error al validar el CUIT/CUIL (ver logs).'),
                    });
                    if (this._saveTimeout) { clearTimeout(this._saveTimeout); this._saveTimeout = null; }
                    this._saving = false;
                });
            }

            // Si es DNI (u otro tipo no CUIT), mostrar aviso y guardar sin validar dígito
            if ((DNI_TYPES.has(norm) || OTHER_TYPES.has(norm)) && name) {
                const displayName = name || _t('Tipo de identificación');
                // Si es DNI, hacer una validación ligera en cliente (7-8 dígitos)
                if (DNI_TYPES.has(norm)) {
                    const vat = this.changes.vat || '';
                    const dniValid = typeof vat === 'string' && /^\d{7,8}$/.test(vat.trim());
                    if (!dniValid && vat) {
                        // Mostrar un único popup y guardar al cerrarlo
                        return this.popup.add(ErrorPopup, {
                            title: _t('Advertencia'),
                            body: _t('DNI inválido') + '\n' + _t('Formato esperado: 7 u 8 dígitos. Se guardará de todas formas.'),
                        }).then(() => this.finalizeSave());
                    }
                    // válido o vacío: guardar silenciosamente
                    this.finalizeSave();
                    return;
                }
                // Otros tipos (LC, LE, PAS, etc.) -> guardar silenciosamente
                this.finalizeSave();
                return;
            }

            // Fallback: si no se detecta el tipo, conservar el comportamiento original:
            // validar CUIT si la configuración lo exige
            const validateCuit = this.pos.config && this.pos.config.validate_cuit;
            if (validateCuit) {
                if (!this.changes.vat) {
                    return this.popup.add(ErrorPopup, {
                        title: _t('Información Faltante'),
                        body: _t('El CUIT/CUIL es obligatorio'),
                    });
                }
                return this.pos.orm
                    .call('res.partner', 'cuit_check', [this.changes.vat])
                    .then((result) => {
                        if (!result) {
                            return this.pos.orm
                                .call('res.partner', 'get_cuit_validation_messages', [this.changes.vat])
                                .then((validation_result) => {
                                    const errorMessages = validation_result.messages || ['CUIT inválido'];
                                    this.popup.add(ErrorPopup, {
                                        title: _t('CUIT Inválido'),
                                        body: errorMessages.join('\n'),
                                    });
                                });
                        } else {
                            this.finalizeSave();
                            if (this._saveTimeout) { clearTimeout(this._saveTimeout); this._saveTimeout = null; }
                            this._saving = false;
                        }
                    })
                    .catch((error) => {
                        const msg = (error && error.message) || (error && error.data && error.data.message) || String(error);
                        this.popup.add(ErrorPopup, {
                            title: _t('Error de Validación'),
                            body: _t('Error al validar CUIT/CUIL: ') + msg,
                        });
                        if (this._saveTimeout) { clearTimeout(this._saveTimeout); this._saveTimeout = null; }
                        this._saving = false;
                    });
            }

            // Si tampoco hay configuración que obligue a validar, guardar normalmente
            return super.saveChanges.call(this);
        };

        // Si el valor detectado parece ser un id numérico o no es un nombre legible,
        // intentamos resolver llamando al servidor al modelo de tipos de identificación.
        const looksLikeId = idTypeName && String(idTypeName).match(/^\d+$/);
        if (looksLikeId) {
            const idInt = parseInt(idTypeName, 10);
            // resolving identification type id via RPC
            return this.pos.orm
                .call('l10n_latam.identification.type', 'name_get', [[idInt]])
                .then((res) => {
                    // res suele ser [[id, name]] o similar
                    let name = null;
                    if (Array.isArray(res) && res.length && Array.isArray(res[0]) && res[0].length >= 2) name = res[0][1];
                    if (!name && res && res.name) name = res.name;
                    // RPC resolved name
                    return runCase(name);
                })
                .catch(() => {
                    // fallback: ejecutar con lo que tenemos
                    return runCase(idTypeName);
                });
        }

        // Si no es id, ejecutar inmediatamente con el nombre detectado
        return runCase(idTypeName);
    },
    
    finalizeSave() {
        // Normalizar CUIT (sin guiones) y guardar
        this.pos.orm
            .call("res.partner", "normalize_cuit", [this.changes.vat])
            .then((normalized_cuit) => {
                // Actualizar con CUIT sin guiones
                this.changes.vat = normalized_cuit;
                // Continuar con el guardado
                super.saveChanges.call(this);
                if (this._saveTimeout) { clearTimeout(this._saveTimeout); this._saveTimeout = null; }
                this._saving = false;
            });
    },
});