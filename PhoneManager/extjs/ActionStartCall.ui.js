/*
 * File: ActionStartCall.ui.js
 * Date: Sun Jan 15 2012 20:57:13 GMT+0100 (CET)
 * 
 * This file was generated by Ext Designer version 1.1.2.
 * http://www.sencha.com/products/designer/
 *
 * This file will be auto-generated each and everytime you export.
 *
 * Do NOT hand edit this file.
 */

ActionStartCallUi = Ext.extend(Ext.form.FieldSet, {
    title: 'Rufnummer wählen',
    initComponent: function() {
        this.items = [
            {
                xtype: 'numberfield',
                fieldLabel: 'Rufnummer',
                anchor: '100%',
                ref: 'remoteNumber'
            },
            {
                xtype: 'textfield',
                fieldLabel: 'Absender',
                anchor: '100%',
                ref: 'localName'
            },
            {
                xtype: 'button',
                text: 'Anruf starten',
                ref: 'buttonStartCall'
            }
        ];
        ActionStartCallUi.superclass.initComponent.call(this);
    }
});