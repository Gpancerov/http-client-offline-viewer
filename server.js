const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { createWriteStream } = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());

// Загружаем ключевые слова и URL из файла
const keywordsPath = path.join(__dirname, 'data', 'keywords.json');
let keywordsData = {};

function loadKeywords() {
  try {
    const raw = fs.readFileSync(keywordsPath, 'utf8');
    keywordsData = JSON.parse(raw);
  } catch (err) {
    console.error('Ошибка при чтении keywords.json:', err);
  }
}

loadKeywords();

// Маршрут: получить список URL по ключевому слову
app.get('/keywords/:key', (req, res) => {
  const key = req.params.key.toLowerCase();
  const urls = keywordsData[key];

  if (!urls) {
    return res.status(404).json({ error: 'Ключ не найден' });
  }

  res.json({ urls });
});

// Установка маршрута POST /download
app.post('/download', async (req, res) => {
    const { url } = req.body || {};


  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Некорректный URL' });
  }

  try {
    const fileName = `${uuidv4()}-${path.basename(url)}`;
    const filePath = path.join(__dirname, 'downloads', fileName);

    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream'
    });

    const totalLength = response.headers['content-length'];
    let downloaded = 0;

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;
      const percent = ((downloaded / totalLength) * 100).toFixed(2);
      console.log(`Прогресс: ${percent}% (${downloaded}/${totalLength})`);
    });

    const writer = createWriteStream(filePath);
    response.data.pipe(writer);

    writer.on('finish', () => {
      console.log('Загрузка завершена:', fileName);
      res.json({ message: 'Файл успешно загружен', file: fileName });
    });

    writer.on('error', (err) => {
      console.error('Ошибка записи файла:', err);
      res.status(500).json({ error: 'Ошибка при сохранении файла' });
    });

  } catch (err) {
    console.error('Ошибка загрузки:', err.message);
    res.status(500).json({ error: 'Не удалось загрузить файл по URL' });
  }
});

// Новый маршрут: скачивание файла по имени
app.get('/download/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'downloads', filename);
  
    // Проверка, существует ли файл
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл не найден' });
    }
  
    // Отправка файла пользователю
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Ошибка при отправке файла:', err);
        res.status(500).json({ error: 'Не удалось скачать файл' });
      }
    });
  });
  
  app.use('/download', express.static(path.join(__dirname, 'downloads')));

  app.use(express.static(path.join(__dirname)));


app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
