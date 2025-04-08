const express = require('express');
const bodyParser = require('body-parser');
const db = require('./models');
const { Op } = require('sequelize');

const env = process.env.NODE_ENV || 'development';
// eslint-disable-next-line import/no-dynamic-require
const config = require(`${__dirname}/config/config.json`)[env];

const app = express();

app.use(bodyParser.json());
app.use(express.static(`${__dirname}/static`));

app.get('/api/games', (req, res) => db.Game.findAll()
  .then(games => res.send(games))
  .catch((err) => {
    console.log('There was an error querying games', JSON.stringify(err));
    return res.send(err);
  }));

app.post('/api/games', (req, res) => {
  const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
  return db.Game.create({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
    .then(game => res.send(game))
    .catch((err) => {
      console.log('***There was an error creating a game', JSON.stringify(err));
      return res.status(400).send(err);
    });
});

app.delete('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then(game => game.destroy({ force: true }))
    .then(() => res.send({ id }))
    .catch((err) => {
      console.log('***Error deleting game', JSON.stringify(err));
      res.status(400).send(err);
    });
});

app.post('/api/games/search', (req, res) => {
  // get user search
  const { name, platform } = req.body

  // build query filter
  const where = {}
  if (name) {
    where.name = { [Op.like]: `%${name}%` }
  }
  if (platform) {
    where.platform = `${platform}`
  }

  // get and return results
  db.Game.findAll({ where })
    .then(games => res.send(games))
    .catch((err) => {
      console.log('***Error searching game', JSON.stringify(err));
      res.status(400).send(err);
    });
});

app.post('/api/games/populate', (req, res) => {
  Promise.all([
    populateGames('android'),
    populateGames('ios'),
  ])
    .then(() => res.send({ ok: true }))
    .catch((err) => {
      console.log('***Error populating game', JSON.stringify(err));
      res.status(400).send(err);
    });
});

function populateGames(platform) {
  return new Promise((resolve, reject) => {

    // get source entries
    const sourceUrl = config.games.sources[platform]
    fetch(sourceUrl).then((response) => {
      response.json().then((entries) => {

        // games upserts promises list
        const promises = []

        // for each game, create an upsert promise
        for (const entry of entries) {
          if (entry instanceof Array) {
            for (const game of entry) {
              promises.push(upsertGame(game, platform))
            }

            // if entry is not an array, something is wrong
          } else {
            console.log('***Unexpected format:', entry)
            return reject('Unexpected entry format')
          }
        }

        // execute upsert promises
        Promise.all(promises).then(resolve).catch(reject)
      })
    })
  })

}

// updates 'game' in the db if it already exists, creates it otherwise
function upsertGame(game, platform) {
  const publisherId = `${game.publisher_id}`
  const name = `${game.name}`
  const storeId = `${game.id}`
  const bundleId = `${game.bundle_id}`
  const appVersion = `${game.version}`
  const isPublished = true // TODO change this ?

  return new Promise((resolve, reject) => {
    // search game
    const where = { platform, storeId }
    db.Game.findOne({ where }).then(game => {

      // if game already exists, update it
      if (game) {
        const data = { publisherId, name, bundleId, appVersion, isPublished }
        game.update(data).then(resolve).catch(reject)
      }

      // if game does not exist yet, insert it
      else {
        const data = { publisherId, name, platform, storeId, bundleId, appVersion, isPublished }
        db.Game.create(data).then(resolve).catch(reject)
      }
    })
  })
}




app.put('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then((game) => {
      const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
      return game.update({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
        .then(() => res.send(game))
        .catch((err) => {
          console.log('***Error updating game', JSON.stringify(err));
          res.status(400).send(err);
        });
    });
});





app.listen(3000, () => {
  console.log('Server is up on port 3000');
});

module.exports = app;
