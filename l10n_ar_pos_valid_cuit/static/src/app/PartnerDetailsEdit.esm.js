/** @odoo-module **/
import {ErrorPopup} from "@point_of_sale/app/errors/popups/error_popup";
import {PartnerDetailsEdit} from "@point_of_sale/app/screens/partner_list/partner_editor/partner_editor";
import {patch} from "@web/core/utils/patch";
import {useService} from "@web/core/utils/hooks";

patch(PartnerDetailsEdit.prototype, {
    setup() {
        super.setup(...arguments);
        this.popup = useService("popup");
        this.changes.vat = this.props.partner.vat;
    },
    saveChanges() {
        // Verificar si la validación CUIT está habilitada en la configuración
        const validateCuit = this.pos.config.validate_cuit;
        const validatePadronA5 = this.pos.config.validate_padron_a5;
        
        // VALIDACIÓN 1: Campo requerido (solo si validación está habilitada)
        if (validateCuit && !this.changes.vat) {
            return this.popup.add(ErrorPopup, {
                title: "Información Faltante",
                body: "El CUIT es obligatorio",
            });
        }
        
        // Si validación CUIT no está habilitada, continuar normalmente
        if (!validateCuit) {
            return super.saveChanges.call(this);
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
                                title: "CUIT Inválido",
                                body: errorMessages.join('\n'),
                            });
                        });
                } else {
                    // CUIT válido - verificar si debe validar con Padrón A5
                    if (validatePadronA5) {
                        // Mostrar mensaje de "En desarrollo" para Padrón A5
                        this.popup.add(ErrorPopup, {
                            title: "Validación Padrón A5",
                            body: "La validación con Padrón A5 está en desarrollo.\nEl CUIT es válido y se guardará normalmente.",
                        });
                        // Continuar con el guardado después del mensaje
                        setTimeout(() => {
                            this.finalizeSave();
                        }, 2000); // Espera 2 segundos para mostrar el mensaje
                    } else {
                        // Solo validación CUIT - proceder directamente
                        this.finalizeSave();
                    }
                }
            })
            .catch((error) => {
                console.error('Error validating CUIT:', error);
                this.popup.add(ErrorPopup, {
                    title: "Error de Validación",
                    body: "Error al validar CUIT: " + error.message,
                });
            });
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
            });
    },
});