# Live Reload

To aid with rapid development the Live Reload feature will allow your browser or mobile device to use your development web server instead of static files on your device. Whenever you change a file in your editor the device will reload your app and display your changes.

In the VS Code extension you can choose `Settings` > `Live Reload` and then run on Web or mobile device to use the Live Reload feature.

Live Reload will use http (not https) and this may affect your application particularly if it uses APIs that require a secure context (such as geolocation, crypto).

## Live Reload with SSL

If your app uses APIs that require a secure context (like web crypto) then it must be served using https. The device will also need to trust the connection which means that if you use a self signed certificate it will need to be installed and trusted on the device.

The VS Code extension can help create a self signed certificate and trust it on devices. Choose `Settings` > `Use HTTPS`. When you check the box `Use HTTPS` it will generate a self signed certificate on your computer and will display a page with instructions on how to download, install and trust the certificate.

After downloading, installing and trusting the certificate on the device you want to test your application you can then run the app and it will be served by your local development server.

## Troubleshooting

### http is always used

Your local development server needs to use https and the created certificate and private key. Angular projects are understand and handled by the VS Code extension. React and Vue projects are not and need manual configuration.

### White Page on Startup

The certificate is not installed and trusted. To do this go to `Settings` > `Use HTTPS` (you may need to uncheck and recheck the option). A web page will display with instructions on installing and trusting the certificate.

You can visit this page on the mobile device to download the certificate and install it.

## Known Issues

### Android SSL Support

> Android devices will not trust a certificate when run in the app (causing a white screen) even when the certificate is installed correctly and displays the web app in Chrome.

You can get around this issue by installing the SSL skip plugin: `npm install @jcesarmobile/ssl-skip`.

### Windows SSL Support

> Windows is not supported or tested (yet).
