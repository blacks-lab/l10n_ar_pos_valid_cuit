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
    },

    async saveChanges() {
        // Obtener representación normalizada de tipo de identificación
        const originalTypeRaw = this.props.partner.l10n_latam_identification_type_id;
        const newTypeRaw = this.changes.l10n_latam_identification_type_id;

        const parseType = (raw) => {
            // Puede venir como [id, name], o como número, o como objeto {id, name}
            if (Array.isArray(raw) && raw.length >= 2) {
                return { id: raw[0], name: raw[1] };
            }
            if (raw && typeof raw === 'object') {
                return { id: raw.id || raw[0] || null, name: raw.name || raw[1] || '' };
            }
            if (typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw))) {
                return { id: parseInt(raw), name: '' };
            }
            return { id: null, name: '' };
        };

        let originalType = parseType(originalTypeRaw);
        let newType = parseType(newTypeRaw);

        // Si falta el nombre pero tenemos id, intentamos obtener la etiqueta vía RPC
        const fetchLabelIfMissing = async (type) => {
            if ((!type.name || type.name === '') && type.id) {
                try {
                    const rec = await this.pos.orm.call('l10n_latam.identification.type', 'browse', [type.id]);
                    if (rec && rec.length > 0) {
                        // algunos browse devuelven dicts con 'name'
                        type.name = rec[0].name || rec[0][1] || '';
                    }
                } catch (e) {
                    // no crítico, dejamos name vacío
                    console.debug('No se pudo obtener etiqueta de tipo de identificación:', e);
                }
            }
            return type;
        };

        originalType = await fetchLabelIfMissing(originalType);
        newType = await fetchLabelIfMissing(newType);

        // Mostrar popup si cambió el tipo de identificación
        if (originalType.id && newType.id && originalType.id !== newType.id) {
            this.popup.add(ErrorPopup, {
                title: _t("Cambio de tipo de identificación"),
                body: _t("Tipo seleccionado: ") + (newType.name || ''),
            });
        }

        // Si no hay vat, continuar (no hay nada que validar)
        if (!this.changes.vat) {
            return super.saveChanges();
        }

        const vat = this.changes.vat.toString().trim();
        // Determinar etiqueta de tipo (si está presente)
    const idTypeLabel = (newType && newType.name) || (originalType && originalType.name) || '';
    const idTypeLower = (idTypeLabel || '').toLowerCase();

        try {
            if (idTypeLower.includes('cuit') || idTypeLower.includes('cuil')) {
                // Delegar a la comprobación CUIT existente
                const result = await this.pos.orm.call("res.partner", "cuit_check", [vat]);
                if (!result) {
                    const validation_result = await this.pos.orm.call(
                        "res.partner",
                        "get_cuit_validation_messages",
                        [vat]
                    );
                    const errorMessages = validation_result.messages || ['CUIT inválido'];
                    return this.popup.add(ErrorPopup, {
                        title: _t("CUIT/CUIL Inválido"),
                        body: _t("El CUIT/CUIL ingresado no es válido:\n") + errorMessages.join('\n'),
                    });
                }
            } else if (idTypeLower.includes('dni')) {
                // Validar DNI usando el nuevo endpoint
                const result = await this.pos.orm.call("res.partner", "dni_check", [vat]);
                if (!result) {
                    const validation_result = await this.pos.orm.call(
                        "res.partner",
                        "get_dni_validation_messages",
                        [vat]
                    );
                    const errorMessages = validation_result.messages || ['DNI inválido'];
                    return this.popup.add(ErrorPopup, {
                        title: _t("DNI Inválido"),
                        body: _t("El DNI ingresado no es válido:\n") + errorMessages.join('\n'),
                    });
                }
            } else {
                // Fallback: comprobación genérica delegada al backend
                const result = await this.pos.orm.call("res.partner", "identification_check", [vat, idTypeLabel]);
                if (!result) {
                    return this.popup.add(ErrorPopup, {
                        title: _t("Identificación Inválida"),
                        body: _t("El valor ingresado para la identificación no parece válido."),
                    });
                }
            }
        } catch (error) {
            console.error('Error validating identification:', error);
            return this.popup.add(ErrorPopup, {
                title: _t("Error de Validación"),
                body: _t("Error al validar la identificación: ") + error.message,
            });
        }

    // Si la validación pasó, continuar con el guardado normal
    return super.saveChanges();
    },
});