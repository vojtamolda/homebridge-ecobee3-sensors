/* jshint esversion: 6 */
/* jshint sub: true */

var UUIDGen, Accessory, EcobeeSensor;
var Querystring = require('querystring');
var Https = require('https');

module.exports = function (uuidGen, accessory, ecobeeSensor) {
  UUIDGen = uuidGen
  Accessory = accessory;
  EcobeeSensor = ecobeeSensor;

  return EcobeePlatform;
};


function EcobeePlatform(log, config, homebridgeAPI) {
  this.log = log;
  this.config = config

  this.exclude_thermostat = config.exclude_thermostat || false;

  this.appKey = "DALCINnO49EYOmMfQQxmx7PYofM1YEGo";
  this.accessToken = null;
  this.refreshToken = null;

  this.ecobeeAccessories = {};
  this.homebridgeAccessories = {};

  this.homebridgeAPI = homebridgeAPI;
  this.homebridgeAPI.on('didFinishLaunching', this.didFinishLaunching.bind(this));
}


EcobeePlatform.prototype.configureAccessory = function (homebridgeAccessory) {
  this.log.debug("Configuring chached Homebridge accessory...");
  this.log.debug(homebridgeAccessory);
  var sensorCode = homebridgeAccessory.context['code'];
  homebridgeAccessory.reachable = false;
  if (homebridgeAccessory.context['refresh_token']) {
    this.accessToken = homebridgeAccessory.context['access_token'];   // This is a bit hackish...
    this.refreshToken = homebridgeAccessory.context['refresh_token']; // This is a bit hackish...
  }
  this.log.info("Cached | " + homebridgeAccessory.displayName + " | " + sensorCode);
  this.homebridgeAccessories[sensorCode] = homebridgeAccessory;
};


EcobeePlatform.prototype.didFinishLaunching = function () {
  this.log.debug("Finished launching...");
  if (!this.accessToken || !this.refreshToken) {
    this.pin();
  } else {
    this.update();
  }
};


EcobeePlatform.prototype.pin = function () {
  this.log.debug("Requesting authorization code...");
  var options = {
    hostname: 'api.ecobee.com',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    path: '/authorize?' + Querystring.stringify({
      'response_type': 'ecobeePin',
      'client_id': this.appKey,
      'scope': 'smartRead'
    }),
    method: 'GET'
  };
  var request = Https.request(options, function (response) {
    var data = '';
    response.on('data', function (chunk) {
      data += chunk;
    });
    response.on('end', function () {
      var reply = JSON.parse(data);
      this.log.debug(reply);
      var pin = reply['ecobeePin'];
      var code = reply['code'];
      this.log.info("These are the steps authorize this application to access your Ecobee 3:");
      this.log.info("  1. Go to https://www.ecobee.com/home/ecobeeLogin.jsp");
      this.log.info("  2. Login to your thermostat console ");
      this.log.info("  3. Select 'MY APPS' from the menu on the top right.");
      this.log.info("  4. Click 'Add Application' ");
      this.log.info("  5. Enter the following authorization code:");
      this.log.info("   ┌──────┐  ");
      this.log.info("   │ " + pin + " │  ");
      this.log.info("   └──────┘  ");
      this.log.info("  6. Wait a moment.")
      this.authorize(code);
    }.bind(this));
  }.bind(this));
  request.on('error', function (error) {
    this.log.error(error + " Retrying request.");
    setTimeout(this.pin.bind(this), 1000);
  }.bind(this));
  request.end();
};


EcobeePlatform.prototype.authorize = function (code) {
  this.log.debug("Authorizing plugin to access the thermostat...");
  var options = {
    hostname: 'api.ecobee.com',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    path: '/token',
    method: 'POST'
  };
  var request = Https.request(options, function (response) {
    var data = '';
    response.on('data', function (chunk) {
      data += chunk;
    });
    response.on('end', function () {
      var reply = JSON.parse(data);
      this.log.debug(reply);
      switch (reply['error'] || null) {
        case null:
          this.log.info("Authorization successful :-)");
          this.accessToken = reply['access_token'];
          this.refreshToken = reply['refresh_token'];
          this.update(this.refresh.bind(this));
          break;
        case 'authorization_pending':
          this.log.warn(reply['error_description'] + " Retrying in 30 seconds.");
          setTimeout(this.authorize.bind(this), 31 * 1000, code);
          break;
        case 'authorization_expired':
          this.log.error(reply['error_description']);
          this.log.error("Expire | 10 minutes.");
          this.pin();
          break;
        default:
          this.log.warn(reply['error_description']);
          this.log.warn("Wait | 10 seconds");
          setTimeout(this.authorize.bind(this), 10 * 1000, code);
          break;
      }
    }.bind(this));
  }.bind(this));
  request.write(Querystring.stringify({
    'grant_type': 'ecobeePin',
    'client_id': this.appKey,
    'code': code
  }));
  request.on('error', function (error) {
    this.log.error(error + " Retrying request.");
    setTimeout(this.authorize.bind(this), 1000, code);
  }.bind(this));
  this.log.debug(request);
  request.end();
};


EcobeePlatform.prototype.update = function (callback) {
  this.log.debug("Updating sensors with fresh data...");
  var options = {
    hostname: 'api.ecobee.com',
    headers: {
      'Content-Type': 'application/json',
      'authorization': 'Bearer ' + this.accessToken
    },
    path: '/1/thermostat?' + Querystring.stringify({
      json: JSON.stringify({
        'selection': {
          'selectionType': 'registered',
          'selectionMatch': '',
          'includeSensors': true
        }
      })
    }),
    method: 'GET'
  };
  var request = Https.request(options, function (response) {
    var data = '';
    response.on('data', function (chunk) {
      data += chunk;
    });
    response.on('end', function () {
      var reply = JSON.parse(data);
      this.log.debug(reply);
      var status = reply['status'] || {'code' : 'default'};
      switch (status['code']) {
        case 0:
          this.log.info("Update sensors");
          this.sensors(reply);
          setTimeout(this.update.bind(this), 31*1000);
          this.log.info("Wait | 30 seconds");
          if (callback) callback();
          break;
        case 14:
          this.log.info("Refresh");
          this.refresh(this.update.bind(this));
          break;
        default:
          this.log.error(status['message'] + " Re-requesting authorization!");
          this.accessToken = null;
          this.refreshToken = null;
          this.pin();
          break;
      }
    }.bind(this));
  }.bind(this));
  request.on('error', function (error) {
    this.log.error(error + " Retrying request.");
    setTimeout(this.update.bind(this), 1000);
  }.bind(this));
  this.log.debug(request);
  request.end();
};


EcobeePlatform.prototype.sensors = function (reply) {
  this.log.debug("Setting values of sensors...");
  if (!reply.thermostatList || reply.thermostatList.length === 0) {
    this.log.error("No Ecobee 3 thermostats found. Please, make soure your thermostat is registered.");
    return;
  }

  for (var thermostatConfig of reply.thermostatList) {
    for (var sensorConfig of thermostatConfig.remoteSensors) {

      if (sensorConfig.type === 'thermostat') {
        if (this.exclude_thermostat) continue;
        sensorConfig.code = thermostatConfig.identifier; // Hack around missing code for the thermostat itself
      }
      var sensorCode = sensorConfig.code;
      var sensor = this.ecobeeAccessories[sensorCode];

      if (!sensor) {
        var homebridgeAccessory = this.homebridgeAccessories[sensorCode];
        if (!homebridgeAccessory) {
          this.log.info("Create | " + sensorConfig.name + " | " + sensorCode);
          homebridgeAccessory = new Accessory(sensorConfig.name, UUIDGen.generate(sensorCode + ' ' + sensorConfig.name));
          homebridgeAccessory.context['code'] = sensorCode;
          this.homebridgeAPI.registerPlatformAccessories("homebridge-ecobee3-sensors", "Ecobee 3 Sensors", [homebridgeAccessory]);
        } else {
          this.log.info("Cached | " + sensorConfig.name + " | " + sensorCode);
          delete this.homebridgeAccessories[sensorCode];
        }
        sensor = new EcobeeSensor(this.log, sensorConfig, homebridgeAccessory);
        this.ecobeeAccessories[sensorCode] = sensor;
      } else {
        sensor.update(sensorConfig);
      }
    }
  }

  this.clean();
};


EcobeePlatform.prototype.clean = function () {
  this.log.debug("Cleaning unused cached Homebridge accessories...");
  this.log.debug(this.homebridgeAccessories);
  for (var sensorCode in this.homebridgeAccessories) {
    var homebridgeAccessory = this.homebridgeAccessories[sensorCode];
    this.log.info("Remove | " + homebridgeAccessory.name + " - " + sensorCode);
    this.homebridgeAPI.unregisterPlatformAccessories("homebridge-ecobee3-sensors", "Ecobee 3 Sensors", [homebridgeAccessory]);
  }
};


EcobeePlatform.prototype.refresh = function (callback) {
  this.log.debug("Refreshing tokens...");
  var options = {
    hostname: 'api.ecobee.com',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    path: '/token',
    method: 'POST'
  };
  var request = Https.request(options, function (response) {
    var data = '';
    response.on('data', function (chunk) {
      data += chunk;
    });
    response.on('end', function () {
      var reply = JSON.parse(data);
      this.log.debug(reply);
      switch (reply['error'] || null) {
        case null:
          this.log.info("Tokens");
          this.accessToken = reply['access_token'];
          this.refreshToken = reply['refresh_token'];
          for (var sensorCode in this.ecobeeAccessories) {
            var sensor = this.ecobeeAccessories[sensorCode]
            var homebridgeAccessory = sensor.homebridgeAccessory;
            homebridgeAccessory.context['access_token'] = this.accessToken;   // This is a bit hackish...
            homebridgeAccessory.context['refresh_token'] = this.refreshToken; // This is a bit hackish...
          }
          if (callback) callback();
          break;
        default:
          this.log.error(reply['error_description'] + " Re-requesting authorization!");
          this.accessToken = null;
          this.refreshToken = null;
          this.pin();
          break;
      }
    }.bind(this));
  }.bind(this));
  request.write(Querystring.stringify({
    'grant_type': 'refresh_token',
    'code': this.refreshToken,
    'client_id': this.appKey
  }));
  request.on('error', function (error) {
    this.log.error(error + " Re-requesting authorization!");
    setTimeout(this.pin.bind(this), 1000);
  }.bind(this));
  this.log.debug(request);
  request.end();
};
