# Argentina POS CUIT Validator

## Descripción

Este módulo valida números de CUIT/CUIL argentinos en el Point of Sale de Odoo 17, utilizando el algoritmo oficial de validación de dígito verificador.

## Características

- Validación automática de CUIT/CUIL al guardar partners en el POS
- Algoritmo de validación específico para Argentina
- Soporte para diferentes formatos de entrada (con guiones, puntos, espacios)
- Mensajes de error detallados en español
- Detección automática de CUITs argentinos

## Validación CUIT/CUIL

El módulo implementa el algoritmo oficial de validación de CUIT/CUIL argentino:

1. **Validación de caracteres**: Solo acepta números, guiones, puntos y espacios
2. **Validación de longitud**: Debe tener exactamente 11 dígitos
3. **Validación de dígito verificador**: Calcula y verifica el dígito verificador usando la secuencia "5432765432"

### Algoritmo del Dígito Verificador

1. Se multiplican los primeros 10 dígitos por la secuencia 5432765432
2. Se suma el resultado de todas las multiplicaciones
3. Se calcula el resto de dividir por 11
4. El dígito verificador es 11 menos el resto, con excepciones:
   - Si el resultado es 11, el dígito verificador es 0
   - Si el resultado es 10, el dígito verificador es 9

## Instalación

1. Copiar el módulo a la carpeta de addons
2. Actualizar la lista de módulos
3. Instalar el módulo "Argentina POS CUIT Validator"

## Dependencias

- point_of_sale
- l10n_ar

## Uso

Una vez instalado, el módulo validará automáticamente los CUITs/CUILs al:

- Crear un nuevo partner en el POS
- Editar un partner existente en el POS
- Detectar automáticamente si un VAT es argentino (por country_id o formato)

## Ejemplos de CUITs válidos

- 20123456780
- 20-12345678-0
- 20.12345678.0
- 27 12345678 9

## Licencia

AGPL-3.0

## Autor

BlackLabs