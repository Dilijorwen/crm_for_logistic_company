/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

const methods = [
  'atX0SecondsPastTheMinuteGt20',
  'atX0MinutesPastTheHourGt20',
  'commaMonthX0ThroughMonthX1',
  'commaYearX0ThroughYearX1',
  'use24HourTimeFormatByDefault',
  'anErrorOccuredWhenGeneratingTheExpressionD',
  'everyMinute',
  'everyHour',
  'atSpace',
  'everyMinuteBetweenX0AndX1',
  'at',
  'spaceAnd',
  'everySecond',
  'everyX0Seconds',
  'secondsX0ThroughX1PastTheMinute',
  'atX0SecondsPastTheMinute',
  'everyX0Minutes',
  'minutesX0ThroughX1PastTheHour',
  'atX0MinutesPastTheHour',
  'everyX0Hours',
  'betweenX0AndX1',
  'atX0',
  'commaEveryDay',
  'commaEveryX0DaysOfTheWeek',
  'commaX0ThroughX1',
  'commaAndX0ThroughX1',
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'commaOnThe',
  'spaceX0OfTheMonth',
  'lastDay',
  'commaOnTheLastX0OfTheMonth',
  'commaOnlyOnX0',
  'commaAndOnX0',
  'commaEveryX0Months',
  'commaOnlyInX0',
  'commaOnTheLastDayOfTheMonth',
  'commaOnTheLastWeekdayOfTheMonth',
  'commaDaysBeforeTheLastDayOfTheMonth',
  'firstWeekday',
  'weekdayNearestDayX0',
  'commaOnTheX0OfTheMonth',
  'commaEveryX0Days',
  'commaBetweenDayX0AndX1OfTheMonth',
  'commaOnDayX0OfTheMonth',
  'commaEveryHour',
  'commaEveryX0Years',
  'commaStartingX0',
  'daysOfTheWeek',
  'monthsOfTheYear',
];

const langs = {
  'en-US': 'en',
  'ru-RU': 'ru',
};

exports.getCronstrueLocale = (lang) => {
  const lng = langs[lang] || 'en';
  const Locale = require(`cronstrue/locales/${lng}`);
  let locale;
  if (Locale?.default) {
    locale = Locale.default.locales[lng];
  } else {
    const L = Locale[lng];
    locale = new L();
  }
  const items = {};
  for (const method of methods) {
    try {
      items[method] = locale[method]();
    } catch (error) {
      // empty
    }
  }
  return items;
};
