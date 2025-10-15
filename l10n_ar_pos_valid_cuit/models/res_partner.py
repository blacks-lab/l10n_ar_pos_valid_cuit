# Copyright 2025 BlackLabs
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

import re
from odoo import api, models
from odoo.exceptions import UserError


class CuitValidator:
    """Validador de CUIL/CUIT
    
    El Código Único de Identificación Tributaria (CUIT) es una clave que se
    utiliza en el sistema tributario de la República Argentina para poder
    identificar inequívocamente a las personas físicas o jurídicas autónomas,
    susceptibles de tributar.
    """
    
    # Codigo de verificacion
    VERIFICATION_CODE = '5432765432'
    MESSAGES = {
        'valid': 'El código «{cuit}», es válido.',
        'invalid': 'Introdujo «{cuit}» y éste no es un número de CUIT válido.',
        'invalid_chars': 'Solo puede introducir: números, guiones medios, puntos o espacios.',
        'invalid_length': 'El número de CUIT debe tener 11 dígitos.'
    }

    def __init__(self, cuit):
        self.cuit = str(cuit)
        self.number = self.filter_chars()

    def validate_digits(self):
        return True if len(self.number) == 11 else False

    def validate_chars(self):
        """Valida si la información pasada por parámetro es adecuada.
        Caracteres válidos (0-9-.\s)
        """
        try:
            regex = re.compile(r'^([0-9\-\.\s]+)$')
            matches = re.search(regex, self.cuit)
            if matches:
                return True
            return False
        except:
            return False

    def filter_chars(self):
        """Limpia el valor de cualquier caracter que no sea un número."""
        regex = re.compile(r'[^0-9]')
        subst = ''
        result = re.sub(regex, subst, self.cuit, 0)
        return result

    def digito_verificador(self):
        """Calcula el dígito verificador.
        
        Digitos verificadores, por cada uno debe multiplicarse los numeros
        del cuit respectivamente.
        
        Returns:
            int: Número verificador
        """
        cuit = self.number
        digito_verificador = None

        v1 = 0
        for i in range(10):
            v1 += int(CuitValidator.VERIFICATION_CODE[i]) * int(cuit[i])

        # obtengo el resto
        v2 = v1 % 11
        # 11 menos el resto
        v3 = 11 - v2
        # si el resultado de v3 es == 11. El valor es 0
        if v3 == 11:
            digito_verificador = 0
        # si v3 es igual a 10. El valor es 9
        elif v3 == 10:
            digito_verificador = 9
        # en todos los demas casos es el v3
        else:
            digito_verificador = v3

        return digito_verificador

    def is_valid_digito_verificador(self):
        """Valida que el número verificador coincida con el del número de
        CUIL ingresado.
        
        Returns:
            bool
        """
        digito_verificador = self.digito_verificador()
        if int(self.number[-1:]) == digito_verificador:
            return True
        return False

    def messages(self):
        """Mensajes de validación."""
        mensajes = []
        if self.is_valid():
            mensajes.append(self.MESSAGES.get('valid').format(cuit=self.cuit))
        else:
            mensajes.append(self.MESSAGES.get('invalid').format(cuit=self.cuit))

        if not self.validate_chars():
            mensajes.append(self.MESSAGES.get('invalid_chars'))

        if not self.validate_digits():
            mensajes.append(self.MESSAGES.get('invalid_length'))

        return mensajes

    def is_valid(self):
        num = self.number
        if (self.validate_chars() and 
            self.validate_digits() and 
            self.is_valid_digito_verificador()):
            return True
        return False


class ResPartner(models.Model):
    _inherit = "res.partner"

    @api.model
    def validate_cuit_ar(self, cuit):
        """Valida un CUIT/CUIL argentino usando el algoritmo específico.
        
        Args:
            cuit (str): El número de CUIT a validar
            
        Returns:
            dict: {'valid': bool, 'messages': list, 'formatted_cuit': str}
        """
        try:
            validator = CuitValidator(cuit)
            is_valid = validator.is_valid()
            messages = validator.messages()
            
            return {
                'valid': is_valid,
                'messages': messages,
                'formatted_cuit': validator.number,
                'original_cuit': cuit
            }
        except Exception as e:
            return {
                'valid': False,
                'messages': [f'Error al validar CUIT: {str(e)}'],
                'formatted_cuit': '',
                'original_cuit': cuit
            }

    @api.model
    def cuit_check(self, vat):
        """Método específico para validar CUIT desde el POS.
        
        Args:
            vat (str): El número de CUIT a validar
            
        Returns:
            bool: True si el CUIT es válido, False en caso contrario
        """
        if not vat:
            return False
            
        # Limpiar el VAT de prefijos de país si los tiene
        clean_vat = vat
        if vat.startswith('AR'):
            clean_vat = vat[2:]
        
        result = self.validate_cuit_ar(clean_vat)
        return result['valid']

    @api.model
    def get_cuit_validation_messages(self, vat):
        """Obtiene los mensajes de validación detallados para mostrar en el POS.
        
        Args:
            vat (str): El número de CUIT a validar
            
        Returns:
            dict: Resultado completo de la validación
        """
        if not vat:
            return {
                'valid': False,
                'messages': ['CUIT no puede estar vacío'],
                'formatted_cuit': '',
                'original_cuit': vat or ''
            }
            
        # Limpiar el VAT de prefijos de país si los tiene
        clean_vat = vat
        if vat.startswith('AR'):
            clean_vat = vat[2:]
            
        return self.validate_cuit_ar(clean_vat)

    @api.model
    def dni_check(self, vat):
        """Validación simple de DNI (Argentina): acepta 7 u 8 dígitos tras normalizar.

        Args:
            vat (str): valor ingresado en el campo vat

        Returns:
            bool: True si parece un DNI válido según esta regla simple
        """
        if not vat:
            return False

        clean_vat = vat
        if vat.startswith('AR'):
            clean_vat = vat[2:]

        # eliminar cualquier caracter que no sea dígito
        cleaned = re.sub(r'[^0-9]', '', clean_vat)
        return len(cleaned) in (7, 8)

    @api.model
    def get_dni_validation_messages(self, vat):
        """Mensajes de validación para DNI.

        Returns estructura similar a get_cuit_validation_messages para facilitar uso en frontend.
        """
        if not vat:
            return {
                'valid': False,
                'messages': ['DNI no puede estar vacío'],
                'formatted_dni': '',
                'original_dni': vat or ''
            }

        clean_vat = vat
        if vat.startswith('AR'):
            clean_vat = vat[2:]

        cleaned = re.sub(r'[^0-9]', '', clean_vat)
        messages = []
        valid = True
        if not cleaned.isdigit():
            messages.append('El DNI sólo puede contener dígitos.')
            valid = False
        if len(cleaned) not in (7, 8):
            messages.append('El DNI debe tener 7 u 8 dígitos.')
            valid = False

        return {
            'valid': valid,
            'messages': messages,
            'formatted_dni': cleaned if valid else '',
            'original_dni': vat
        }

    @api.model
    def identification_check(self, vat, id_type_label=False):
        """Check genérico por tipo de identificación.

        Si id_type_label contiene 'cuit' o 'cuil' se delega a cuit_check,
        si contiene 'dni' se delega a dni_check, en otro caso se hace una
        comprobación conservadora (no vacío, sólo dígitos/longitud mínima 6).
        """
        if not vat:
            return False

        label = (id_type_label or '').lower()
        if 'cuit' in label or 'cuil' in label:
            return self.cuit_check(vat)
        if 'dni' in label:
            return self.dni_check(vat)

        # fallback conservador: aceptar si tiene al menos 6 dígitos
        clean_vat = vat
        if vat.startswith('AR'):
            clean_vat = vat[2:]
        cleaned = re.sub(r'[^0-9]', '', clean_vat)
        return len(cleaned) >= 6