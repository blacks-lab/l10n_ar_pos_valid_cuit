# Copyright 2025 BlackLabs
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

import re
from odoo import api, models


def validar_cuit(cuit):
    """
    Valida el formato y el dígito verificador de un CUIT argentino usando el algoritmo oficial.

    Args:
        cuit (str): El número de CUIT/CUIL a validar.

    Returns:
        bool: True si el CUIT es válido, False en caso contrario.
    """
    # Codigo de verificacion oficial
    VERIFICATION_CODE = '5432765432'
    
    # Limpiar el CUIT de cualquier caracter que no sea número
    cuit_str = str(cuit)
    regex = re.compile(r'[^0-9]')
    number = re.sub(regex, '', cuit_str, 0)
    
    # Verificar la longitud
    if len(number) != 11:
        return False
    
    # Calcular el dígito verificador
    v1 = 0
    for i in range(10):
        v1 += int(VERIFICATION_CODE[i]) * int(number[i])
    
    # Obtener el resto
    v2 = v1 % 11
    # 11 menos el resto  
    v3 = 11 - v2
    
    # Si el resultado de v3 es == 11, el valor es 0
    if v3 == 11:
        digito_verificador = 0
    # Si v3 es igual a 10, el valor es 9
    elif v3 == 10:
        digito_verificador = 9
    # En todos los demás casos es el v3
    else:
        digito_verificador = v3
    
    # Comparar el dígito verificador calculado con el último dígito del CUIT
    return int(number[-1:]) == digito_verificador


def validate_chars(cuit):
    """Valida si la información pasada por parámetro es adecuada.
    Caracteres válidos (0-9-. y espacios)
    """
    try:
        regex = re.compile(r'^([0-9\-\.\s]+)$')
        matches = re.search(regex, str(cuit))
        return bool(matches)
    except:
        return False


def filter_chars(cuit):
    """Limpia el valor de cualquier caracter que no sea un número."""
    regex = re.compile(r'[^0-9]')
    subst = ''
    result = re.sub(regex, subst, str(cuit), 0)
    return result


class ResPartner(models.Model):
    _inherit = "res.partner"

    @api.model
    def cuit_check(self, vat):
        """Valida un CUIT argentino usando el algoritmo oficial."""
        if not vat:
            return False
        
        return validar_cuit(vat)
    
    @api.model  
    def get_cuit_validation_messages(self, vat):
        """Obtiene mensajes de error para mostrar en POS."""
        if not vat:
            return {'messages': ['CUIT es requerido']}
        
        # Validar caracteres
        if not validate_chars(vat):
            return {'messages': ['Solo puede introducir: números, guiones medios, puntos o espacios']}
        
        # Limpiar y validar longitud
        number = filter_chars(vat)
        if len(number) != 11:
            return {'messages': ['El número de CUIT debe tener 11 dígitos']}
        
        # Validar dígito verificador
        if not validar_cuit(vat):
            return {'messages': ['El dígito verificador del CUIT es incorrecto']}
        
        return {'messages': []}
    
    @api.model
    def normalize_cuit(self, vat):
        """Normaliza CUIT removiendo caracteres especiales, dejando solo números."""
        if not vat:
            return ''
        
        return filter_chars(vat)