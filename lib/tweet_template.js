module.exports = ({ amount, mts }, lastPrice, lastBalance) => [
  (+(amount.toFixed(2))).toLocaleString(),
  '$LEO',
  `(${(+((amount * lastPrice).toFixed(2))).toLocaleString()} USD)`,
  `were burned today at ${new Date(mts).toUTCString().split(' ').splice(4).join(' ')} 🔥.`,
  `Total supply is now ${(+(lastBalance.toFixed(2))).toLocaleString()} 🦁.`,
].join(' ')
