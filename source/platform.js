/* jshint esversion: 6 */
/* jshint sub: true */

var UUIDGen, Accessory, EcobeeSensor, EcobeeEquipment;
var Querystring = require('querystring');
var Https = require('https');

const Verbosity = Object.freeze({
    None: 0,
    Error: 1,
    Warn: 2,
    Info: 3,
    Debug: 4
})


class EBLogger {
    constructor(log) {
        this.hbLog = log;
    }

    setLevel(level) {
        this.logLevel = level;
    }

    debug(args) {
        if (this.logLevel >= Verbosity.Debug) {
            this.hbLog.debug(args);
        }
    }

    info(args) {
        if (this.logLevel >= Verbosity.Info) {
            this.hbLog.info(args);
        }
    }

    warn(args) {
        if (this.logLevel >= Verbosity.Warn) {
            this.hbLog.warn(args);
        }
    }

    error(args) {
        if (this.logLevel >= Verbosity.Error) {
            this.hbLog.error(args);
        }
    }

    getLevelStr() {
        switch (this.logLevel) {
            case Verbosity.None: return "None";
            case Verbosity.Error: return "Error";
            case Verbosity.Warn: return "Warn";
            case Verbosity.Info: return "Info";
            case Verbosity.Debug: return "Debug";
            default: return "Unknown";
        }
    }
}


module.exports = function (uuidGen, accessory, ecobeeSensor, ecobeeEquipment) {
  UUIDGen = uuidGen
  Accessory = accessory;
  EcobeeSensor = ecobeeSensor;
  EcobeeEquipment = ecobeeEquipment;

  return EcobeePlatform;
};


function EcobeePlatform(log, config, homebridgeAPI) {
 if (!config) {
    log.warn(" Ignoring Ecobee Sensor Plugin setup because it is not configured");
    this.disabled = true;
    return;
  }

  this.log = new EBLogger(log);  
  this.config = config || {};

  this.excludeSensors = this.config.exclude_sensors || false;
  this.excludeHumiditySensors = this.config.exclude_humidity_sensors || false;
  this.excludeOccupancySensors = this.config.exclude_occupancy_sensors || false;
  this.excludeTemperatureSensors = this.config.exclude_temperature_sensors || false;
  this.excludeEquipmentSensors = this.config.exclude_equipment_sensors || false;
  this.excludeThermostat = this.config.ex || false;
  this.updateFrequency = this.config.update_frequency || 30;
  this.logLevel = this.config.log_level || Verbosity.Info;

  this.log.setLevel(this.logLevel);
  log.info("Log level set to " + this.log.getLevelStr());

  this.appKey = this.config.app_key || "DALCINnO49EYOmMfQQxmx7PYofM1YEGo";
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
      this.log.info("These are the steps authorize this application to access your Ecobee:");
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
          'includeSensors': true,
          'includeEquipmentStatus': true
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
          this.log.info("Update equipments");
          this.equipments(reply);
          this.clean();
          setTimeout(this.update.bind(this), this.updateFrequency*1000);
          this.log.info("Wait | " + this.updateFrequency + " seconds");
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
    this.log.error("No Ecobee thermostats found. Please, make soure your thermostat is registered.");
    return;
  }

  for (var thermostatConfig of reply.thermostatList) {
    if ((thermostatConfig.modelNumber != 'vulcanSmart') && (thermostatConfig.modelNumber != 'athenaSmart') && (thermostatConfig.modelNumber != 'apolloSmart') && (thermostatConfig.modelNumber != 'nikeSmart') && (thermostatConfig.modelNumber != 'aresSmart')) {
      this.log.info("Not supported thermostat | " + thermostatConfig.name + " (" + thermostatConfig.modelNumber + ")");
      continue
    }

    for (var sensorConfig of thermostatConfig.remoteSensors) {
      if (sensorConfig.type === 'thermostat') {
        if (this.excludeThermostat) continue;
        sensorConfig.code = thermostatConfig.identifier; // Hack around missing code for the thermostat itself
      }
      if (sensorConfig.type === 'ecobee3_remote_sensor') {
        if (this.excludeSensors) continue;
      }
      if (sensorConfig.capability) {
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
          sensor = new EcobeeSensor(this.log, sensorConfig, this, homebridgeAccessory);
          this.ecobeeAccessories[sensorCode] = sensor;
        } else {
          sensor.update(sensorConfig);
        }
      }
    }
  }
};


EcobeePlatform.prototype.equipments = function (reply) {
  this.log.debug("Setting values of equipments...");
  if (!reply.thermostatList || reply.thermostatList.length === 0) {
    this.log.error("No Ecobee thermostats found. Please, make soure your thermostat is registered.");
    return;
  }

  var activeEquipments = [];
  for (var thermostatConfig of reply.thermostatList) {
    if ((thermostatConfig.modelNumber != 'vulcanSmart') && (thermostatConfig.modelNumber != 'athenaSmart') && (thermostatConfig.modelNumber != 'apolloSmart') && (thermostatConfig.modelNumber != 'nikeSmart') && (thermostatConfig.modelNumber != 'aresSmart')) {
      this.log.info("Not supported thermostat | " + thermostatConfig.name + " (" + thermostatConfig.modelNumber + ")");
      continue
    }

    if (thermostatConfig.equipmentStatus) {
      for (var equipmentName of thermostatConfig.equipmentStatus.split(',')) {
        if (equipmentName === '') continue;
        equipmentName = "Ecobee " + equipmentName.trim();
        var equipment = this.ecobeeAccessories[equipmentName];
      
        if (!equipment) {
          var homebridgeAccessory = this.homebridgeAccessories[equipmentName];
          if (!homebridgeAccessory) {
            this.log.info("Create | " + equipmentName);
            homebridgeAccessory = new Accessory(equipmentName, UUIDGen.generate(`equipment ${equipmentName}`));
            homebridgeAccessory.context['code'] = equipmentName;
            this.homebridgeAPI.registerPlatformAccessories("homebridge-ecobee3-sensors", "Ecobee 3 Sensors", [homebridgeAccessory]);
          } else {
            this.log.info("Cached | " + equipmentName);
            delete this.homebridgeAccessories[equipmentName];
          }
          equipment = new EcobeeEquipment(this.log, { name: equipmentName, code: equipmentName }, this, homebridgeAccessory);
          this.ecobeeAccessories[equipmentName] = equipment;
        }
        activeEquipments.push(equipmentName);
      }
    }
  }

  for (var equipmentName in this.ecobeeAccessories) {
    var equipment = this.ecobeeAccessories[equipmentName];
    if (equipment.isEquipment) {
      equipment.update(activeEquipments.includes(equipmentName));
    }
  }
};

EcobeePlatform.prototype.clean = function () {
  this.log.debug("Cleaning unused cached Homebridge accessories...");
  this.log.debug(this.homebridgeAccessories);
  for (var sensorCode in this.homebridgeAccessories) {
    var homebridgeAccessory = this.homebridgeAccessories[sensorCode];
    this.log.info("Remove | " + homebridgeAccessory.displayName + " - " + sensorCode);
    try {
    this.homebridgeAPI.unregisterPlatformAccessories("homebridge-ecobee3-sensors", "Ecobee 3 Sensors", [homebridgeAccessory]);
    } catch (e) {
      this.log.error(e);
    }
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
