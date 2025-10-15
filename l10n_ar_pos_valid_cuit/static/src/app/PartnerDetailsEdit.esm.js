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
        // Mostrar popup si cambió el tipo de identificación
        const originalType = this.props.partner.l10n_latam_identification_type_id;
        const newType = this.changes.l10n_latam_identification_type_id;
        if (originalType && newType && originalType[0] !== newType[0]) {
            this.popup.add(ErrorPopup, {
                title: _t("Cambio de tipo de identificación"),
                body: _t("Tipo seleccionado: ") + (newType[1] || ''),
            });
        }

        // Si no hay vat, continuar (no hay nada que validar)
        if (!this.changes.vat) {
            return super.saveChanges();
        }

        const vat = this.changes.vat.toString().trim();
        // Determinar etiqueta de tipo (si está presente)
        const idTypeLabel = (newType && newType[1]) || (originalType && originalType[1]) || '';
        const idTypeLower = idTypeLabel.toLowerCase();

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
        
        // Si la validación pasó o no se requería, continuar con el guardado normal
        return super.saveChanges();
    },
});