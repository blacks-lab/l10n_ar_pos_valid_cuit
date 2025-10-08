#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de prueba para validar CUITs manualmente
Usar: python test_cuit_manual.py
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from models.res_partner import CuitValidator

def test_cuits():
    """Prueba varios CUITs conocidos"""
    
    # CUITs de prueba (algunos válidos, algunos inválidos)
    test_cases = [
        # Formato: (cuit, esperado_válido, descripción)
        ("20279468529", True, "CUIT válido conocido"),
        ("20-27946852-9", True, "CUIT válido con guiones"),
        ("20.27946852.9", True, "CUIT válido con puntos"),
        ("20 27946852 9", True, "CUIT válido con espacios"),
        ("30123456787", True, "CUIT empresa válido"),
        ("27123456789", True, "CUIT persona válido"),
        ("20123456780", False, "CUIT con dígito verificador incorrecto"),
        ("1234567890", False, "CUIT muy corto"),
        ("123456789012", False, "CUIT muy largo"),
        ("abcdefghijk", False, "CUIT con caracteres inválidos"),
        ("", False, "CUIT vacío"),
        ("20-12345678-1", False, "CUIT con dígito verificador incorrecto"),
    ]
    
    print("=== PRUEBAS DE VALIDACIÓN DE CUIT ===\n")
    
    for cuit, expected, description in test_cases:
        try:
            validator = CuitValidator(cuit)
            is_valid = validator.is_valid()
            
            status = "✓ PASS" if is_valid == expected else "✗ FAIL"
            print(f"{status} | {description}")
            print(f"      CUIT: '{cuit}' -> Válido: {is_valid} (Esperado: {expected})")
            
            if not is_valid:
                messages = validator.messages()
                for msg in messages[1:]:  # Skip the first message (valid/invalid)
                    print(f"      Detalle: {msg}")
            
            print()
            
        except Exception as e:
            print(f"✗ ERROR | {description}")
            print(f"      CUIT: '{cuit}' -> Error: {str(e)}")
            print()

def test_digit_calculation():
    """Prueba el cálculo del dígito verificador"""
    
    print("=== PRUEBAS DE CÁLCULO DE DÍGITO VERIFICADOR ===\n")
    
    # Casos de prueba para dígito verificador
    test_cases = [
        "2027946852",  # Los primeros 10 dígitos
        "3012345678",
        "2712345678",
    ]
    
    for partial_cuit in test_cases:
        validator = CuitValidator(partial_cuit + "0")  # Agregar un dígito dummy
        calculated_digit = validator.digito_verificador()
        
        print(f"CUIT parcial: {partial_cuit}")
        print(f"Dígito verificador calculado: {calculated_digit}")
        print(f"CUIT completo sería: {partial_cuit}{calculated_digit}")
        
        # Verificar si el CUIT completo es válido
        full_cuit = partial_cuit + str(calculated_digit)
        full_validator = CuitValidator(full_cuit)
        print(f"¿Es válido el CUIT completo? {full_validator.is_valid()}")
        print()

if __name__ == "__main__":
    test_cuits()
    test_digit_calculation()