var sensCO2  = require('moduleSensorCO2');    // Подключаем модуль для работы с датчиками CO2

// Для удобства создадим объект, где опишем нужные параметры
var CO2 = {
    title: 'CO2 в офисе',
    name: 'co2_office',
    target: ['wb-msw-v4_80/CO2']
};

// Передаём в функцию параметры
sensCO2.createCO2( CO2.title , CO2.name , CO2.target );

// Для компактности можно сразу передать в функцию параметры и обойтись одной строчкой:
//sensCO2.createCO2( 'CO2 в офисе' , 'co2_office' , ['wb-msw-v4_80/CO2'] );