/*
 * File: WaitingWindow.ui.js
 * Date: Sun Jan 15 2012 20:57:13 GMT+0100 (CET)
 * 
 * This file was generated by Ext Designer version 1.1.2.
 * http://www.sencha.com/products/designer/
 *
 * This file will be auto-generated each and everytime you export.
 *
 * Do NOT hand edit this file.
 */

WaitingWindowUi = Ext.extend(Ext.Window, {
    width: 350,
    height: 47,
    closable: false,
    padding: 5,
    initComponent: function() {
        this.items = [
            {
                xtype: 'progress',
                value: 1,
                region: 'center',
                animate: true,
                text: 'bitte warten',
                ref: 'progressbar'
            }
        ];
        WaitingWindowUi.superclass.initComponent.call(this);
    }
});