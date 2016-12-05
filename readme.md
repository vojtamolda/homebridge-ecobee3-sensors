
# homebridge-ecobee3-sensors

[![NPM version](https://badge.fury.io/js/homebridge-ecobee3-sensors.svg)](https://badge.fury.io/js/homebridge-ecobee3-sensors)

[Homebridge](https://github.com/nfarina/homebridge) plugin for exposing wireless temperature and occupancy sensors of your [Ecobee 3 Thermostat](https://www.ecobee.com/ecobee3/) as [HomeKit](https://www.apple.com/ios/home/) accesories. The thermostat itself is a HomeKit accessory, but the sensors are not visible in the [Home app](https://www.apple.com/ios/home/) out of the box. This plugin fixes this problem, so you can have home automation rules based on room occupancy :-)

<img src="images/overview.png">

Homebridge runs on top of [Node.js](https://nodejs.org) server and is an open-source implementation of the Apple HomeKit protocol. HomeKit provides the API between your Apple device (i.e. Watch) and your home automation server (i.e. Raspberry Pi). This Homebridge [plugin](https://www.npmjs.com/package/homebridge-bluetooth) relays the communication from the home automation server to the BLE peripheral device (i.e. Arduino 101). Take a peek into the [examples](/examples/) folder for inspiration.

<img src="images/homebridge.png">



## Installation

Make sure your systems matches the [prerequisites](#what-are-the-prerequisites-for-installation). You need to have a C compiler and [Node.js](https://nodejs.org) server.

### Install Homebridge
[Homebridge](https://github.com/nfarina/homebridge) is a lightweight framework built on top of [Node.js](https://nodejs.org/) server that provides the HomeKit bridge for your Apple devices to connect to.

```sh
[sudo] npm install -g --unsafe-perm homebridge node-gyp
[sudo] npm install -g homebridge-ecobee3-sensors
```

**Note** _Depending on your privileges `-g` flag may need root permissions to install to the global `npm` module directory._

### Configure Homebridge
Homebridge is setup via `config.json` file sitting in the `~/.homebridge/` directory. The [example config](config.json) included in the repository has lots of comments and is a good starting point.

### Run Homebridge
Depending on your privileges, accessing the BLE kernel subsystem may need root permissions.

```sh
[sudo] homebridge
```



## Authorization

<img src="images/ecobee-auth-1.png">
<img src="images/ecobee-auth-2.png">
<img src="images/ecobee-auth-3.png">
<img src="images/ecobee-auth-4.png">
<img src="images/ecobee-auth-5.png">
<img src="images/homebridge-auth-5.png">
<img src="images/ecobee-auth-6.png">
<img src="images/homebridge-auth-6.png">



## Apple Device

### Pairing
Open Home app and tap the '+' button to add new accessory. When you attempt to add the 'Raspberry Pi 3' bridge, it will ask for a "PIN" from the `config.json` file. Once you are paired with your new Rapsberry Homebridge server all the Arduino accesory can be added the same way as the bridge.

### Interacting
Once your BLE accessory has been added to HomeKit database, besides using the Home app or Control Center at the bottom of the screen, you should be able to tell Siri to control any HomeKit accessory. Try _"Hey Siri, dim RGB LED to 50%"_. However, Siri is a cloud service and iOS may need some time to synchronize your HomeKit database to iCloud.

<img src="images/home.png" width="30%">
<img src="images/home-center.png" width="30%">
<img src="images/home-hallway.png" width="30%">

<img src="images/home-kitchen.png" width="30%">
<img src="images/home-living.png" width="30%">
<img src="images/home-occupancy.png" width="30%">



## Troubleshooting

If you encouter a different problem, please, open an [issue](https://github.com/vojtamolda/homebridge-ecobee3-sensors/issues).

### Home app can't discover any nearby accessories
Make sure the Apple device and the Homebridge server are on the same subnet and connected to the same wifi router.

Sometimes, Homebridge server might think that, it has successfully paired with iOS, but iOS doesn't agree. Try to delete the `persist/` directory in the `~/.homebridge/` configuration folder. This removes all pairings that normally persist from session to session.

```sh
rm -rf ~/.homebridge/persist/
```

From time to time it looks like iOS ignores HomeKit bridges with `username` that it has already paired with. Try to change the `username` in the `bridge` section of `config.json` to a new value never used before.



## FAQ

### Can I contribute my own feature?
Sure thing! All contributions are welcome. Just do a pull-request or open a new issue if you see something broken or something that needs improvement.


### How frequently are the sensors updated?
The polling request to get new values of each sensor is scheduled every 30 seconds. However, according to the [Ecobee documentation](https://www.ecobee.com/home/developer/api/documentation/v1/operations/get-thermostat-summary.shtml), the shortest sensor update interval is every 3 minutes.

### What are the prerequisites for installation?

#### Linux (Debian Based, Kernel 3.6 or newer)
A supported  BLE (Bluetooth 4.0) USB dongle is required, if your device doesn't have it built-in.

 - Install [Node.js](https://nodejs.org/en/download/)

   [Node.js](https://nodejs.org) is an asynchronous event driven JavaScript server, ideal for building scalable, low-latency network applications. [Homebridge](https://www.npmjs.com/package/homebridge) is built on top of this server. It is being developed so quickly that package repositories of most distributions contain a very old version. Getting latest from the official website is recommended.

#### macOS (10.10 or newer)
Check [this link](http://www.imore.com/how-tell-if-your-mac-has-bluetooth-40) to see if your mac has built-in BLE (Bluetooth 4.0) support. All macs from 2012 and newer are generally fine.

 - Install [Node.js](https://nodejs.org/en/download/)

   [Node.js](https://nodejs.org) is an asynchronous event driven JavaScript server, ideal for building scalable, low-latency network applications. [Homebridge](https://www.npmjs.com/package/homebridge) is built on top of this server. It is being developed so quickly that package repositories of most distributions contain a very old version. Getting latest from the official website is recommended.

 - Install [XCode](https://itunes.apple.com/ca/app/xcode/id497799835?mt=12)

   [XCode](https://developer.apple.com/xcode/) comes with a C compiler that is needed to compile the JavaScript to C bindings required by [Noble](https://www.npmjs.com/package/noble) package.

#### Windows (8.1 or newer)
Pull request is welcomed here... [Homebridge](https://www.npmjs.com/package/homebridge) should run on Windows, but I don't have a machine to test.


### Can I access my sensors without this plugin?
Yes. The sensors are visible in the [Ecobee app](https://itunes.apple.com/us/app/ecobee/id916985674?mt=8). They're also accessible by Siri out of the box, although somewhat cumbersomly. See [this link](https://www.ecobee.com/faq/what-voice-commands-can-i-use-to-control-my-homekit-enabled-ecobee3/) for a full list of available commands.


### On what devices was this plugin tested?
Here's a list of testing devices. The list is by no means exhaustive and the plugin will work with many more.
- Apple Device
  - [iPhone](https://en.wikipedia.org/wiki/IPhone) 5S & 6 running [iOS](https://en.wikipedia.org/wiki/IOS) 10

- Homebridge Server
  - [Raspberry Pi](https://en.wikipedia.org/wiki/Raspberry_Pi) 3 & 2 (with USB dongle) running [Raspbian](https://www.raspberrypi.org/downloads/raspbian/)  Jessie Lite
  - [Macbook Air](https://en.wikipedia.org/wiki/MacBook_Air) (2015) & [iMac](https://en.wikipedia.org/wiki/IMac) (2012) running [macOS](https://en.wikipedia.org/wiki/MacOS) 10.12



## License
This work is licensed under the MIT license. See [license](license.txt) for more details.
