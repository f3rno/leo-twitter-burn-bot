'use strict'

require('dotenv').config()

const Request = require('request-promise')
const debug = require('debug')('leo-burn-twitter-bot')
const { RESTv2 } = require('bfx-api-node-rest')
const PI = require('p-iteration')
const FileSync = require('lowdb/adapters/FileSync')
const LowDB = require('lowdb')
const Twitter = require('twitter')
const TweetTemplate = require('./lib/tweet_template')

const LAST_REPORTED_BURN_KEY = 'lastReportedBurn'
const {
  DB_FILENAME,
  LAST_MANUAL_BURN,
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET,
  TWITTER_ACCESS_TOKEN_KEY,
  TWITTER_ACCESS_TOKEN_SECRET,
} = process.env

debug('starting up (db %s)', DB_FILENAME)

const rest = new RESTv2({ transform: true })
const db = LowDB(new FileSync(DB_FILENAME))
const twitterClient = new Twitter({
  consumer_key: TWITTER_CONSUMER_KEY,
  consumer_secret: TWITTER_CONSUMER_SECRET,
  access_token_key: TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: TWITTER_ACCESS_TOKEN_SECRET,
})

const getLastReportedBurn = () => db.get(LAST_REPORTED_BURN_KEY).value() || +LAST_MANUAL_BURN
const burnModel = ([ mts, chain, tx, amount ]) => ({ mts, chain, tx, amount })

Request('https://api-pub.bitfinex.com/v2/leo/burn/hist').then(res => {
  let burns

  try {
    burns = JSON.parse(res)
  } catch (e) {
    throw new Error(`error parsing API response: ${res}`)
  }

  const lastBurnMTS = getLastReportedBurn()
  const burnsSinceLastReport = burns
    .filter(b => b[0] > lastBurnMTS)
    .map(burnModel)


  burnsSinceLastReport.sort((a, b) => a.mts - b.mts)

  return { burnsSinceLastReport }
}).then(data => {
  return rest.ticker('tLEOUSD').then(ticker => ({ ...data, ticker }))
}).then(data => {
  return Request('https://api-pub.bitfinex.com/v2/stats1/leo.burn.supply:1d:val/last').then(res => {
    let lastBalance

    try {
      lastBalance = JSON.parse(res)
    } catch (e) {
      throw new Error(`error parsing API response: ${res}`)
    }

    return { ...data, lastBalance: lastBalance[1] }
  })
}).then(({ burnsSinceLastReport, lastBalance, ticker }) => {
  const { lastPrice } = ticker.toJS()

  return PI.forEachSeries(burnsSinceLastReport, (burn) => {
    const tweetText = TweetTemplate(burn, lastPrice, lastBalance)

    console.log(tweetText)

    /*
    return twitterClient.post('statuses/update', {
      status: tweetText
    }).then(() => {
      debug('tweeted: %s', tweetText)
      db.set(LAST_REPORTED_BURN_KEY, burn.mts).write()
    })
    */
  })
}).catch(e => {
  debug('error: %s', e.stack)
})