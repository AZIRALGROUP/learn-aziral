import { createHash } from 'node:crypto';
import { openStore, validateQuestions } from './store.mjs';

const db = openStore(process.env.TELEGRAM_DATABASE || undefined);
const id = name => createHash('sha256').update('aziral-learn-demo:' + name).digest('hex').slice(0, 32);
try {
  db.prepare('INSERT OR IGNORE INTO users VALUES (?,?,?)').run('aziral-learn-demo', 'Aziral Learn', null);
  const questions = validateQuestions([
    { question: 'Сколько будет 7 × 8?', options: ['54', '56', '64', '48'], correct: 1, explanation: '7 × 8 = 56. Можно посчитать 7 × (10 − 2) = 70 − 14.' },
    { question: 'Чему равно 1/4 + 1/4?', options: ['1/8', '1/4', '1/2', '1'], correct: 2, explanation: 'Складываем числители: 1/4 + 1/4 = 2/4 = 1/2.' },
    { question: 'Сколько составляет 15% от 200?', options: ['15', '20', '25', '30'], correct: 3, explanation: '200 × 15 / 100 = 30.' },
    { question: 'Найди x: 3x + 6 = 18.', options: ['4', '6', '8', '12'], correct: 0, explanation: 'Вычитаем 6 из обеих частей: 3x = 12. Делим на 3: x = 4.' },
    { question: 'Чему равна сумма внутренних углов треугольника на плоскости?', options: ['90°', '180°', '270°', '360°'], correct: 1, explanation: 'В евклидовой геометрии сумма внутренних углов треугольника равна 180°.' },
  ]);
  db.prepare('INSERT OR IGNORE INTO tests VALUES (?,?,?,?,?,?,?)').run(id('math'), 'aziral-learn-demo', 'Демо: математическая разминка', 'Математика', JSON.stringify(questions), 1, Date.now());
  const lessons = [
    { title: 'Начни с тренировки', content: 'Открой раздел «Тесты» и выбери «Тренироваться». На каждый вопрос можно дать один ответ. В тренировке разрешено возвращаться к предыдущим вопросам. После завершения появятся оценка и разбор ошибок.' },
    { title: 'Создай свой материал', content: 'Нажми «Создать тест», заполни название и предмет. Добавь вопросы вручную или открой помощника ИИ. Перед генерацией проверь, что в конспекте нет личных данных. Перечитай все вопросы и правильные ответы перед сохранением. Новый тест — личный черновик; кнопка «Опубликовать для всех» добавит его в общую библиотеку.' },
    { title: 'Пригласи друга', content: 'Выбери «Дуэль» рядом с тестом и отправь ссылку другу. Другу нужно открыть бота, перейти в приложение и принять вызов. После входа второго игрока у вас будет 3 секунды на подготовку. Каждый раунд длится 15 секунд. Верный ответ даёт 1000 очков, быстрый — до 150 дополнительных. Результаты появятся после последнего раунда.' },
  ];
  db.prepare('INSERT OR IGNORE INTO courses VALUES (?,?,?,?,?,?,?)').run(id('intro'), 'aziral-learn-demo', 'Как учиться в Aziral Learn', 'Короткое знакомство с тестами, курсами и дуэлями.', JSON.stringify(lessons), 1, Date.now());
  console.log('Demo math test and introductory course are ready (existing data preserved).');
} finally { db.close(); }
