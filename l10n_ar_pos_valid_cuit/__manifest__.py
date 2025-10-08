# Copyright 2025 BlackLabs
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
{
    "name": "Argentina POS CUIT Validator",
    "summary": "Validate Argentina CUIT/CUIL in Point of Sale - Required + Valid",
    "version": "17.0.1.0.0",
    "category": "Point Of Sale",
    "website": "https://github.com/blacks-lab",
    "author": "BlackLabs",
    "license": "AGPL-3",
    "application": False,
    "installable": True,
    "depends": [
        "point_of_sale",
    ],
    "assets": {
        "point_of_sale._assets_pos": [
            "l10n_ar_pos_valid_cuit/static/src/app/PartnerDetailsEdit.esm.js",
        ],
    },
    "data": [
        "views/pos_config_views.xml",
    ],
    "demo": [],
    "auto_install": False,
}