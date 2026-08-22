# Crypto Price Tracker for Gnome-Shell

<p align="center">
 <a href="https://github.com/alipirpiran/Crypto-Price-Tracker-for-Gnome-Shell/blob/master/LICENSE">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg">
 </a>
 <a href="https://github.com/alipirpiran/Crypto-Price-Tracker-for-Gnome-Shell">
  <img src="https://badges.frapsoft.com/os/v2/open-source.png?v=103">
 </a>
 <a href="https://t.me/mralpr">
  <img src="https://img.shields.io/badge/Chat%20on-telegram-blue" alt="Telegram">
  </a>
 </p>
 <br />
 
An extension for Gnome-Shell to track price of Crypto currencies.
<br />
<br />
<p align="center">
 <img src="https://github.com/alipirpiran/Crypto-Price-Tracker-for-Gnome-Shell/raw/screenshots/36.png" alt="Screenshot">
 </p>
 
 <br />
 
* Refresh price every 10 sec
* Add new pair e.g BTC/USDT
* Sources: Binance, OKX, Coingecko, Crypto.com
* [Display multiple coins](#display-multiple-coins)

## Installation

### Through extensions.gnome.org (Local installation)

Go on the [CryptoPriceTracker](https://extensions.gnome.org/extension/2817/crypto-price-tracker/) extension page on extensions.gnome.org, click on the switch ("OFF" => "ON"), click on the install button. That's it !

### With source code

Clone the git repo:

``` shell
$ git clone https://github.com/alipirpiran/Crypto-Price-Tracker-for-Gnome-Shell.git
```

Create extension dir and Copy files in it:

``` shell
$ mkdir -p ~/.local/share/gnome-shell/extensions/crypto@alipirpiran.github/ 

$ cp -r ./Crypto-Price-Tracker-for-Gnome-Shell/* ~/.local/share/gnome-shell/extensions/crypto@alipirpiran.github/
```

* Restart Gnome-shell. (ALT+F2, r, Enter)

* You may need to enable the extension via Gnome Tweaks

## Display multiple coins

Activate multiple coins from the menu and display them all in the top bar.  
  
<img src="https://github.com/alipirpiran/Crypto-Price-Tracker-for-Gnome-Shell/raw/screenshots/multicoin.gif">

Thanks to [azorpax](https://github.com/azorpax) for creating this feature. [Pull request](https://github.com/alipirpiran/Crypto-Price-Tracker-for-Gnome-Shell/pull/10#issue-1351086191)

## Sources

* ### Binance

    List of pairs: <https://www.binance.com/indexSpa.html>

    Example: BTC/USDT

* ### OKX

    List of pairs: <https://www.okx.com/markets/spot-list>

    Example: BTC/USDT

* ### Crypto.com

    List of pairs: <https://crypto.com/exchange/trade>

    Example: BTC/USDT

* ### Coingecko

    List of coin ids (name): <https://api.coingecko.com/api/v3/coins/list>

    List of compare currencies (vol): <https://api.coingecko.com/api/v3/simple/supported_vs_currencies>

    Example: BTC/USD

## Adding a price source

1. Create `api/sources/<id>.js` implementing the source contract: `id`, `label`,
   `icon`, `assetClass`, `minPollInterval`, `supportsBatch`, and the
   `parseSymbol`/`buildUrl`/`parsePrices`/`chartUrl` methods. Look at
   `api/sources/binance.js` for a short example.
2. Register it: add one import and one line to the `SOURCES` array in
   `api/sources/index.js`.
3. Add a `sample: { coins, response, error }` field to your source, a real
   API response and error envelope for the test suite to check `parsePrices`
   against. Run `./tests/capture-sample.js <id>`: it fetches both a real
   response and the API's error envelope, and prints a block to paste in.

That's it, `gjs -m tests/run.js` picks the new source up automatically.

## Example List of coins

| Name/Vol |
| ------ |
BTC/USDT
BTC/EUR
ETH/LTC
XRP/USDT
BNB/BTC

## License

[MIT](https://github.com/alipirpiran/Crypto-Price-Tracker-for-Gnome-Shell/blob/master/LICENSE)
