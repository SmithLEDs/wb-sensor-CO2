/**
 * @brief   Модуль создает виртуальное устройство для слежения за датчиками углекислого газа CO2.
 * @authors SmithLEDs (https://github.com/SmithLEDs/wb-sensor-CO2)
 * @version v.1.0
 * 
 *  < 600     | Приемлимо
 *  600-1000  | Жалобы на несвежий воздух
 *  1000-2500 | Общая вялость
 *  2500-5000 | Возможны нежелательные эффекты на здоровье
 * 
 * @param {string}  title           Описание виртуального устройства (Можно на русском)
 * @param {string}  name            Имя виртуального устройства (Будет отображаться в новом виртуальном устройстве как name/... )
 * @param {string}  targetCO2       Одиночный топик или массив топиков, по изменению которых 
 *                                  будет происходить обработка значений и вывод результата
 * 
 */

exports.createCO2  = function( title , name , targetCO2 ) {
    log.warning('[' + title + ']: Перезагрузка модуля, ожидание устройств...');

    // Объект для хранения устройств
    var oCO2 = {
        target: [],  
        error:  [],
        virt:   [],
        value:  [],
        valid:  [],
        name:   name + ' (CO2Devices)',
        exist:  false,
        typeAVG: 3,
        validGroup: true
    };

    var test_interval = null;
    var i = 0;
    var qty = 60;
    
    test_interval = setInterval(function () {
        var loadDivicesOK = true;
        ++i;

        if ( targetCO2 && !devicesExists(targetCO2) ) loadDivicesOK = false;

        // Если все устройства существуют или закончилось кол-во попыток проверок
        if ( loadDivicesOK || (i > qty) ) {
            clearInterval(test_interval);

            reloadDeviceArray( targetCO2 , oCO2 , name + '/CO2_' );

            if ( !oCO2.exist ) {
                log.error(name + " - Нет ни одного устройства для отслеживания! Расходимся...");
            } else { 
                createVirtualDevice(title, name);

                addControlDevice( name , oCO2);
    
                createErrorRule( name , oCO2 );

                createRulesCO2 ( title , name , oCO2 );
            }
        }
    }, 5000);  
}


/**
 * @brief   Функция проверяет на существование одного устройства и его контрола.
 * 
 * @param {string} topic Топик для проверки типа "device/control"
 */
function deviceExists( topic ) {
    var device  = topic.split('/')[0];
    var control = topic.split('/')[1];
    var exists = false;

    if ( getDevice(device) !== undefined ) {
        if ( getDevice(device).isControlExists(control) ) {
            exists = true;
        }
    } else {
        log.error("{} - не существует", topic);
    }

    return exists;
}


/**
 * @brief   Функция проверяет на существование устройств.
 * 
 * @param {string} topic Топик или массив топиков для проверки типа "device/control"
 * @return Если хоть одно устройство не доступно, то возвращаем false
 */
function devicesExists( topic ) {
    var exists = true;
    if (topic == undefined) return false;
    if (topic.constructor === Array) {
        for (var i = 0, l = topic.length; i < l; ++i) {
            if (!deviceExists(topic[i])) {
                exists = false;
                break;
            }
        }
    } else {
        if ( !deviceExists(topic) ) exists = false;
    }
    return exists;
}

/**
 * @brief   Функция перебирает массив устройств и добавляет существующие
 *          устройства к объекту с массивами, с которым в дальнейшем работает главная 
 *          функция
 * @param {*} source    Массив или переменная - источник физических устройств
 * @param {object} target    Объект, в который добавятся только существующие устройства
 * @param {string} name      Имя для добавления нового виртуального устройства
 */
function reloadDeviceArray( source , target , name ) {
    if (source == undefined) return;
    if ( source.constructor === Array ) {
        var i = 0;
        source.forEach( function (item, index, arr) {
            if ( deviceExists(item) ) {
                target.target.push( item );
                target.error.push( item + "#error" );
                target.virt.push( name + i );
                target.valid.push(true);
                target.exist = true;
                i++;
            }
        });
    } else {
        if ( deviceExists(source) ) {
            target.target.push( source );
            target.error.push( source + "#error" );
            target.virt.push( name + 0 );
            target.valid.push(true);
            target.exist = true;
        }
    }
}


/**
 * @brief   Функция создания виртуального устройства.
 *          В дальнейшем к этому устройству добавляются дополнительные контролы
 * @param {string}  title   Описание виртуального устройства (Можно на русском)
 * @param {string}  name    Имя виртуального устройства (Будет отображаться в новом виртуальном кстройстве как name/... )
 */
function createVirtualDevice( title , name ) {
    defineVirtualDevice( name, {
        title: title,
        cells: {
            // Среднее значение по всем датчикам
            average: {
                title: 'Среднее значение',
                type: "value",
                value: 0,
                readonly: true,
                units: "ppm"
            },
            // Вывод состояния на здоровье
            state: {
                title: 'Состояние',
                type: "value",
                enum: {
                    1: {'en': 'Norm',             'ru': 'Норма'},
                    2: {'en': 'Stale air',        'ru': 'Несвежий воздух'},
                    3: {'en': 'General lethargy', 'ru': 'Общая вялость'},
                    4: {'en': 'Exceeding',        'ru': 'Превышение!!!'}
                },
                value: 0,
                readonly: true
            },
            // Метод подсчёта среднего значения
            typeAVG: {
                title: 'Рассчёт среднего',
                type: "value",
                readonly: false,
                value: 3,
                enum: {
                    1: {'en': 'Minimum',         'ru': 'Минимум'},
                    2: {'en': 'Maximum',         'ru': 'Максимум'},
                    3: {'en': 'Arithmetic mean', 'ru': 'Среднее арифметическое'}
                }
            },
            // Тут просто выводим общее кол-во отслеживаемых датчиков CO2
            qtyCO2: {
                title: 'Кол-во датчиков CO2',
                type: "value",
                value: 0,
                readonly: true
            }
        }
    });
}


/**
 * @brief   Функция добавляет к виртуальному устройству новые контролы, если они существуют
 * @param {string} name     Имя виртуального устройства, к которому добавлять новые контролы
 * @param {object} CO2      Объект с устройствами CO2
 */
function addControlDevice( name , CO2 ) {

    // Если есть устройства CO2
    if ( CO2.exist ) {
        dev[name]['qtyCO2'] = CO2.target.length;
        CO2.target.forEach( function (item, index, arr) {
            CO2.value[index] = dev[item];
            getDevice(name).addControl( CO2.virt[index].split('/')[1] , { 
                title: item, 
                type: "value", 
                value: CO2.value[index], 
                readonly: true,
                forceDefault: true,
                units: "ppm"
            });   
            if ( dev[CO2.error[index]] !== undefined ) {
                dev[CO2.virt[index] + '#error'] = dev[CO2.error[index]];
                CO2.valid[index] = false;
            }              
        });
    }  
}


/**
 * @brief   Функция создает правило для слежения за meta #error
 * 
 * @param {*} target Объект с массивами устройств
 */
function createErrorRule( name , target ) {
    if ( !target.exist ) return;
    defineRule(target.name + ' ruleError', {
        whenChanged:  target.error,
        then: function (newValue, devName, cellName) {
            var i = target.error.indexOf( devName + '/' + cellName );
            if ( i != -1 ) dev[target.virt[i] + '#error'] = newValue;
            if ( newValue ) {
                target.valid[i] = false;
                var v = false;
                // Проверяем все остальные устройства на валидность.
                // Если ВСЕ устройства не валидны, значит вся группа не валидна
                target.valid.forEach( function(item) {
                    if (item) v = true;
                });
                target.validGroup = v;
            } else {
                // Создаем таймер на задержку после восстановления связи
                setTimeout(function () {
                    target.valid[i] = true;
                    target.validGroup = true;
                }, 2000);
            }
        }
    });
}


function createRulesCO2 ( title , name , CO2 ) {

    // Правило отслеживает изменение типа подсчета среднего значения
    defineRule(name + '_modeAVGChange', {
        when: function () {
            return dev[name]['typeAVG'];
        },
        then: function () {
            CO2.typeAVG = dev[name]['typeAVG'];
        }
    });

    // Правило отслеживает валидность группы датчиков CO2
    // Если нет ни одного датчика, которому можно верить, то 
    // подсветим для наглядности
    defineRule(name + '_CO2ValidGroup', {
        asSoonAs: function () {
            return !CO2.validGroup;
        },
        then: function () {
            dev[name]['average#error'] = "r";
        }
    });

    // Правило отслеживает изменение датчиков CO2
    defineRule(name + '_CO2Change', {
        whenChanged: CO2.target,
        then: function (newValue, devName, cellName) {

            // Изменяем наш виртуальный контрол для наглядности
            var i = CO2.target.indexOf( devName + '/' + cellName );
            if ( i != -1 ) {
                CO2.value[i] = newValue;
                dev[CO2.virt[i]] = newValue;
            }

            var min = 10000;
            var max = 0;
            var avg = 0;
            var qty = 0;
            CO2.value.forEach( function(item, index) {
                if ( CO2.valid[index] ) {
                    qty++;
                    if ( item < min ) min = item;
                    if ( item > max ) max = item;
                    avg += item;
                }
            } );
            
            if ( qty > 0 ) {
                switch ( CO2.typeAVG ) {
                    case 1: // Минимум
                        avg = min;
                        break;
                    case 2: // Максимум
                        avg = max;
                        break;
                    case 3: // Среднее арифметическое
                        avg = Math.round( avg/qty );
                        break;
                }
                dev[name]["average"] = avg;

                var state;
                if ( avg <= 600 ) { state = 1; } 
                else if ( avg > 600 && avg <= 1000 ) { state = 2; } 
                else if ( avg > 1000 && avg <= 2500 ) { state = 3; } 
                else { state = 4; }
                dev[name]["state"] = state;
            }
            
        }
    });
}

