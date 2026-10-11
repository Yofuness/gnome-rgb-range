// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

Gio._promisify(Gio.DBusProxy.prototype, 'init_async');
Gio._promisify(Gio.DBusProxy.prototype, 'call');

const DISPLAY_CONFIG_NAME = 'org.gnome.Mutter.DisplayConfig';
const DISPLAY_CONFIG_PATH = '/org/gnome/Mutter/DisplayConfig';

// Values of the "rgb-range" monitor property (mutter!4489). The property is
// absent when the output doesn't support Broadcast RGB.
const RgbRange = {
    UNKNOWN: 0,
    AUTO: 1,
    FULL: 2,
    LIMITED: 3,
};

const RGB_RANGES = [RgbRange.AUTO, RgbRange.FULL, RgbRange.LIMITED];

// ApplyMonitorsConfig method; same as `gdctl set --persistent`
const CONFIG_METHOD_PERSISTENT = 2;

function rgbRangeLabel(value) {
    switch (value) {
    case RgbRange.AUTO:
        return _('Auto');
    case RgbRange.FULL:
        return _('Full');
    case RgbRange.LIMITED:
        return _('Limited (16-235)');
    default:
        return _('Unknown');
    }
}

function unpackProperty(properties, key, fallback) {
    const value = properties[key];
    if (value === undefined)
        return fallback;
    return value instanceof GLib.Variant ? value.deepUnpack() : value;
}

function findCurrentModeId(modes) {
    const mode =
        modes.find(([, , , , , , props]) => unpackProperty(props, 'is-current', false)) ??
        modes.find(([, , , , , , props]) => unpackProperty(props, 'is-preferred', false)) ??
        modes[0];
    return mode?.[0] ?? '';
}

const RgbRangeToggle = GObject.registerClass(
class RgbRangeToggle extends QuickSettings.QuickMenuToggle {
    constructor() {
        super({
            title: _('RGB Range'),
            subtitle: _('Loading…'),
            iconName: 'video-display-symbolic',
            toggleMode: false,
        });

        this.menu.setHeader('video-display-symbolic', _('RGB Range'),
            _('Display color quantization range'));

        // Scrollable, so many monitors don't push the menu off screen
        this._section = new PopupMenu.PopupMenuSection();
        const scrollView = new St.ScrollView({
            styleClass: 'rgb-range-scrollview vfade',
            hscrollbarPolicy: St.PolicyType.NEVER,
            vscrollbarPolicy: St.PolicyType.AUTOMATIC,
            child: this._section.actor,
        });
        this.menu.box.add_child(scrollView);

        this._serial = 0;
        this._monitors = [];
        this._logicalMonitors = [];
        this._applying = false;

        this._cancellable = new Gio.Cancellable();
        this._proxy = new Gio.DBusProxy({
            gConnection: Gio.DBus.session,
            gName: DISPLAY_CONFIG_NAME,
            gObjectPath: DISPLAY_CONFIG_PATH,
            gInterfaceName: DISPLAY_CONFIG_NAME,
        });
        this._proxy.connectObject('g-signal', (_proxy, _sender, signalName) => {
            if (signalName === 'MonitorsChanged')
                this._refresh().catch(e => console.error(e));
        }, this);

        this._initProxy().catch(e => console.error(e));
    }

    async _initProxy() {
        try {
            await this._proxy.init_async(GLib.PRIORITY_DEFAULT, this._cancellable);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                console.error(e, 'Failed to connect to DisplayConfig');
                this.subtitle = _('Unavailable');
            }
            return;
        }
        await this._refresh();
    }

    async _refresh() {
        let result;
        try {
            result = await this._proxy.call('GetCurrentState', null,
                Gio.DBusCallFlags.NONE, -1, this._cancellable);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                throw e;
            return;
        }

        [this._serial, this._monitors, this._logicalMonitors] = result.deepUnpack();
        this._sync();
    }

    _sync() {
        this._section.removeAll();

        if (this._monitors.length === 0) {
            this.checked = false;
            this.subtitle = _('No monitors');
            return;
        }

        const overrides = [];
        const showHeadings = this._monitors.length > 1;

        for (const [[connector], , properties] of this._monitors) {
            const displayName = unpackProperty(properties, 'display-name', connector);
            const current = unpackProperty(properties, 'rgb-range', RgbRange.UNKNOWN);

            if (showHeadings) {
                this._section.addMenuItem(
                    new PopupMenu.PopupSeparatorMenuItem(`${displayName} (${connector})`));
            }

            if (current === RgbRange.UNKNOWN) {
                const item = new PopupMenu.PopupMenuItem(_('Not supported on this output'));
                item.setSensitive(false);
                this._section.addMenuItem(item);
                continue;
            }

            if (current !== RgbRange.AUTO)
                overrides.push(`${rgbRangeLabel(current)} · ${connector}`);

            for (const value of RGB_RANGES) {
                const item = new PopupMenu.PopupMenuItem(rgbRangeLabel(value));
                item.setOrnament(value === current
                    ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
                item.connect('activate', () => this._setRgbRange(connector, value));
                this._section.addMenuItem(item);
            }
        }

        this.checked = overrides.length > 0;
        if (overrides.length === 1)
            this.subtitle = overrides[0];
        else if (overrides.length > 1)
            this.subtitle = _('Multiple overrides');
        else
            this.subtitle = _('Auto');
    }

    async _setRgbRange(connector, rgbRange) {
        if (this._applying)
            return;
        this._applying = true;

        const modeIds = new Map(
            this._monitors.map(([[conn], modes]) => [conn, findCurrentModeId(modes)]));

        const logicalMonitors = this._logicalMonitors.map(
            ([x, y, scale, transform, primary, monitors]) => [
                x, y, scale, transform, primary,
                monitors.map(([conn]) => {
                    const props = {};
                    if (conn === connector)
                        props['rgb-range'] = new GLib.Variant('u', rgbRange);
                    return [conn, modeIds.get(conn) ?? '', props];
                }),
            ]);

        const parameters = new GLib.Variant('(uua(iiduba(ssa{sv}))a{sv})',
            [this._serial, CONFIG_METHOD_PERSISTENT, logicalMonitors, {}]);

        try {
            await this._proxy.call('ApplyMonitorsConfig', parameters,
                Gio.DBusCallFlags.NONE, -1, this._cancellable);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                console.error(e, 'Failed to apply monitor configuration');
                Main.notifyError(_('RGB Range'),
                    _('Could not change the RGB range for %s').format(connector));
            }
        } finally {
            this._applying = false;
        }
    }

    destroy() {
        this._cancellable.cancel();
        this._proxy.disconnectObject(this);
        this._proxy = null;
        super.destroy();
    }
});

const RgbRangeIndicator = GObject.registerClass(
class RgbRangeIndicator extends QuickSettings.SystemIndicator {
    constructor() {
        super();
        this.quickSettingsItems.push(new RgbRangeToggle());
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});

export default class RgbRangeExtension extends Extension {
    enable() {
        this._indicator = new RgbRangeIndicator();
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
