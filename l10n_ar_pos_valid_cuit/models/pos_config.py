# Copyright 2025 BlackLabs
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    validate_cuit = fields.Boolean(
        string='Validar CUIT',
        default=True
    )
    
    validate_padron_a5 = fields.Boolean(
        string='Validar con Padrón A5',
        default=False
    )