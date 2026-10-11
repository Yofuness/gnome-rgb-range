# RGB Range Quick Settings

A GNOME Shell extension that adds an **RGB Range** toggle to Quick Settings.
It lets you switch each display's RGB quantization range between **Auto**,
**Full** and **Limited (16–235)**, so you don't need a terminal or to log out.

It uses Mutter's `org.gnome.Mutter.DisplayConfig` D-Bus interface, the same
one `gdctl` uses. Changes are persistent, like
`gdctl set --persistent -M <connector> -r <range>`.

Supports GNOME Shell 49, 50 and 51. Mutter gained the RGB range property in
[mutter!4489](https://gitlab.gnome.org/GNOME/mutter/-/merge_requests/4489).
If an output's driver doesn't expose it, the menu shows
"Not supported on this output".

## Install from source

```sh
gnome-extensions pack src --force
gnome-extensions install --force rgb-range-quicksettings@johann.local.shell-extension.zip
```

Log out and back in, then enable it:

```sh
gnome-extensions enable rgb-range-quicksettings@johann.local
```

## Uninstall

```sh
gnome-extensions uninstall rgb-range-quicksettings@johann.local
```

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
