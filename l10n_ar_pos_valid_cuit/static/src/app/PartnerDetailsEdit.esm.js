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
        // VALIDACIÓN 1: Campo requerido
        if (!this.changes.vat) {
            return this.popup.add(ErrorPopup, {
                title: _t("Información Faltante"),
                body: _t("El CUIT es obligatorio"),
            });
        }
        
        // VALIDACIÓN 2: Validar CUIT argentino completo
        this.pos.orm
            .call("res.partner", "cuit_check", [this.changes.vat])
            .then((result) => {
                if (!result) {
                    // CUIT inválido - obtener mensajes específicos
                    this.pos.orm
                        .call("res.partner", "get_cuit_validation_messages", [this.changes.vat])
                        .then((validation_result) => {
                            const errorMessages = validation_result.messages || ['CUIT inválido'];
                            this.popup.add(ErrorPopup, {
                                title: _t("CUIT Inválido"),
                                body: errorMessages.join('\n'),
                            });
                        });
                } else {
                    // CUIT válido - normalizar (sin guiones) y guardar
                    this.pos.orm
                        .call("res.partner", "normalize_cuit", [this.changes.vat])
                        .then((normalized_cuit) => {
                            // Actualizar con CUIT sin guiones
                            this.changes.vat = normalized_cuit;
                            // Continuar con el guardado
                            super.saveChanges.call(this);
                        });
                }
            })
            .catch((error) => {
                console.error('Error validating CUIT:', error);
                this.popup.add(ErrorPopup, {
                    title: _t("Error de Validación"),
                    body: _t("Error al validar CUIT: ") + error.message,
                });
            });
    },
});