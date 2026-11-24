/*
 * Демо-каталог CoinUA.
 * Ціни, залишки й характеристики — приклад для розробки інтерфейсу.
 * Замініть їх реальними даними (або підвантажуйте з API) перед запуском.
 */
window.CATALOG = {
  categories: [
    { id: 'coins', label: 'Монети', title: 'Монети' },
    { id: 'sets', label: 'Набори', title: 'Набори монет' },
    { id: 'banknotes', label: 'Банкноти', title: 'Банкноти' },
    { id: 'medals', label: 'Медалі й жетони', title: 'Медалі й жетони' },
    { id: 'accessories', label: 'Альбоми й капсули', title: 'Альбоми й капсули' }
  ],
  periods: [
    { id: 'rus', label: 'Київська Русь' },
    { id: 'unr', label: 'УНР, 1917–1921' },
    { id: 'ussr', label: 'СРСР' },
    { id: 'ua', label: 'Україна, з 1991' }
  ],
  grades: ['VF', 'XF', 'AU', 'UNC', 'BU', 'PROOF'],
  metals: {
    gold: 'Золото',
    silver: 'Срібло',
    cuni: 'Нейзильбер',
    steel: 'Сталь / латунь',
    paper: 'Папір',
    mixed: 'Змішаний'
  },
  items: [
    { id: 'c01', code: 'UA-PM-0412', cat: 'coins', name: 'Пам’ятна монета 10 гривень', metal: 'silver', period: 'ua', year: 2023, grade: 'PROOF', price: 2450, stock: 4, weight: '31,1 г', diameter: '38,6 мм', edge: 'Рифлений', desc: 'Срібна пам’ятна монета у капсулі, з сертифікатом Національного банку.' },
    { id: 'c02', code: 'UA-PM-0388', cat: 'coins', name: 'Пам’ятна монета 5 гривень', metal: 'cuni', period: 'ua', year: 2022, grade: 'UNC', price: 180, stock: 25, weight: '16,54 г', diameter: '35 мм', edge: 'Рифлений', desc: 'Монета з нейзильберу, стан UNC — без слідів обігу.' },
    { id: 'c03', code: 'UA-IN-0007', cat: 'coins', name: 'Інвестиційна монета, 1 унція', metal: 'gold', period: 'ua', year: 2024, grade: 'BU', price: 118500, stock: 2, weight: '31,1 г', diameter: '32 мм', edge: 'Рифлений', desc: 'Інвестиційна золота монета 999,9 проби. Ціна залежить від курсу металу.' },
    { id: 'c04', code: 'UA-OB-1996', cat: 'coins', name: 'Обігова монета 1 гривня', metal: 'steel', period: 'ua', year: 1996, grade: 'XF', price: 95, stock: 12, weight: '7,1 г', diameter: '26 мм', edge: 'Гладкий', desc: 'Монета першого року випуску гривні, незначні сліди обігу.' },
    { id: 'c05', code: 'UA-PM-0301', cat: 'coins', name: 'Пам’ятна монета 20 гривень', metal: 'silver', period: 'ua', year: 2019, grade: 'PROOF', price: 4200, stock: 1, weight: '62,2 г', diameter: '50 мм', edge: 'Гладкий', desc: 'Велика срібна монета, якість карбування PROOF.' },
    { id: 'c06', code: 'UA-PM-0275', cat: 'coins', name: 'Пам’ятна монета 2 гривні', metal: 'cuni', period: 'ua', year: 2017, grade: 'UNC', price: 120, stock: 30, weight: '12,8 г', diameter: '31 мм', edge: 'Рифлений', desc: 'Нейзильбер, серія «Видатні особистості».' },
    { id: 'c07', code: 'UA-PM-0102', cat: 'coins', name: 'Пам’ятна монета 100 гривень', metal: 'gold', period: 'ua', year: 2008, grade: 'PROOF', price: 96000, stock: 0, weight: '17,28 г', diameter: '25 мм', edge: 'Рифлений', desc: 'Золота пам’ятна монета. Наразі немає в наявності — підпишіться на сповіщення.' },
    { id: 'c08', code: 'UA-OB-2020', cat: 'coins', name: 'Обігова монета 10 гривень', metal: 'steel', period: 'ua', year: 2020, grade: 'UNC', price: 40, stock: 50, weight: '6,4 г', diameter: '26 мм', edge: 'Переривчасто рифлений', desc: 'Монета нового зразка в стані UNC.' },
    { id: 'c09', code: 'RUS-SR-0010', cat: 'coins', name: 'Срібник Володимира', metal: 'silver', period: 'rus', year: 990, grade: 'VF', price: 285000, stock: 1, weight: '2,9 г', diameter: '27 мм', edge: '—', desc: 'Одна з перших монет Київської держави, з експертним висновком.' },
    { id: 'c10', code: 'SU-JR-1965', cat: 'coins', name: 'Ювілейний рубль', metal: 'cuni', period: 'ussr', year: 1965, grade: 'AU', price: 150, stock: 8, weight: '12,8 г', diameter: '31 мм', edge: 'Гуртовий напис', desc: 'Ювілейна монета радянського періоду.' },
    { id: 'c11', code: 'SU-KP-1961', cat: 'coins', name: 'Монета 20 копійок', metal: 'cuni', period: 'ussr', year: 1961, grade: 'XF', price: 35, stock: 40, weight: '3,4 г', diameter: '21,8 мм', edge: 'Рифлений', desc: 'Перший рік після грошової реформи 1961 року.' },

    { id: 's01', code: 'UA-NB-2024', cat: 'sets', name: 'Річний набір обігових монет 2024', metal: 'mixed', period: 'ua', year: 2024, grade: 'UNC', price: 650, stock: 15, weight: '6 монет', diameter: '—', edge: '—', desc: 'Набір усіх обігових монет року у пластиковому планшеті.' },
    { id: 's02', code: 'UA-NB-FF12', cat: 'sets', name: 'Серія «Флора і фауна» в альбомі', metal: 'cuni', period: 'ua', year: 2021, grade: 'UNC', price: 2400, stock: 3, weight: '12 монет', diameter: '—', edge: '—', desc: 'Повна серія пам’ятних монет у фірмовому альбомі.' },
    { id: 's03', code: 'UA-NB-GIFT', cat: 'sets', name: 'Подарунковий набір «Рік народження»', metal: 'mixed', period: 'ua', year: 2008, grade: 'UNC', price: 1250, stock: 9, weight: '5 монет', diameter: '—', edge: '—', desc: 'Монети обраного року в дерев’яному футлярі. Можливе гравіювання.' },
    { id: 's04', code: 'SU-NB-1991', cat: 'sets', name: 'Річний набір монет 1991', metal: 'mixed', period: 'ussr', year: 1991, grade: 'UNC', price: 900, stock: 2, weight: '9 монет', diameter: '—', edge: '—', desc: 'Набір останнього року випуску в оригінальній упаковці.' },

    { id: 'b01', code: 'UA-BN-1992-1', cat: 'banknotes', name: 'Банкнота 1 гривня, 1992', metal: 'paper', period: 'ua', year: 1992, grade: 'UNC', price: 260, stock: 10, weight: '—', diameter: '133×66 мм', edge: '—', hue: 48, desc: 'Перший випуск гривні, без слідів обігу.' },
    { id: 'b02', code: 'UA-BN-1992-500', cat: 'banknotes', name: 'Банкнота 500 гривень, 1992', metal: 'paper', period: 'ua', year: 1992, grade: 'XF', price: 3900, stock: 1, weight: '—', diameter: '133×66 мм', edge: '—', hue: 20, desc: 'Рідкісна банкнота першої серії.' },
    { id: 'b03', code: 'UA-BN-PM-2021', cat: 'banknotes', name: 'Пам’ятна банкнота в буклеті', metal: 'paper', period: 'ua', year: 2021, grade: 'UNC', price: 1100, stock: 6, weight: '—', diameter: '150×75 мм', edge: '—', hue: 210, desc: 'Пам’ятна банкнота у сувенірному буклеті НБУ.' },
    { id: 'b04', code: 'UNR-BN-1917-100', cat: 'banknotes', name: '100 карбованців УНР, 1917', metal: 'paper', period: 'unr', year: 1917, grade: 'VF', price: 2300, stock: 3, weight: '—', diameter: '170×112 мм', edge: '—', hue: 32, desc: 'Перша банкнота Української Народної Республіки.' },
    { id: 'b05', code: 'UNR-BN-1918-2', cat: 'banknotes', name: '2 гривні УНР, 1918', metal: 'paper', period: 'unr', year: 1918, grade: 'XF', price: 850, stock: 5, weight: '—', diameter: '100×65 мм', edge: '—', hue: 120, desc: 'Банкнота другої грошової системи УНР.' },
    { id: 'b06', code: 'UA-KP-1991', cat: 'banknotes', name: 'Купон 100 карбованців, 1991', metal: 'paper', period: 'ua', year: 1991, grade: 'UNC', price: 70, stock: 20, weight: '—', diameter: '105×53 мм', edge: '—', hue: 270, desc: 'Купоно-карбованець перехідного періоду.' },

    { id: 'm01', code: 'UA-MD-0021', cat: 'medals', name: 'Настільна медаль «Київ»', metal: 'cuni', period: 'ua', year: 2012, grade: 'UNC', price: 540, stock: 4, weight: '45 г', diameter: '60 мм', edge: 'Гладкий', desc: 'Пам’ятна настільна медаль у футлярі.' },
    { id: 'm02', code: 'UA-JT-0003', cat: 'medals', name: 'Жетон метрополітену', metal: 'steel', period: 'ua', year: 1995, grade: 'XF', price: 30, stock: 60, weight: '3 г', diameter: '20 мм', edge: 'Гладкий', desc: 'Пластиковий і металевий жетони різних років.' },

    { id: 'a01', code: 'ACC-AL-001', cat: 'accessories', name: 'Альбом для пам’ятних монет', metal: 'mixed', period: 'ua', year: 2025, grade: 'UNC', price: 480, stock: 18, weight: '—', diameter: '—', edge: '—', desc: 'Альбом на 48 комірок із прозорими листами.' },
    { id: 'a02', code: 'ACC-KP-038', cat: 'accessories', name: 'Капсули для монет 38 мм, 10 шт.', metal: 'mixed', period: 'ua', year: 2025, grade: 'UNC', price: 120, stock: 100, weight: '—', diameter: '38 мм', edge: '—', desc: 'Прозорі капсули для зберігання монет.' }
  ]
};
