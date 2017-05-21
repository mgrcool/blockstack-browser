import bip39 from 'bip39'
import { authorizationHeaderValue, btcToSatoshis, encrypt,
  getIdentityPrivateKeychain,
  getBitcoinPrivateKeychain,
  getIdentityAddressNode,
  getIdentityAddress,
  getBitcoinAddress } from '../../utils'

import { randomBytes } from 'crypto'
import { HDNode } from 'bitcoinjs-lib'

import log4js from 'log4js'

const logger = log4js.getLogger('account/store/account.js')


const CREATE_ACCOUNT = 'CREATE_ACCOUNT',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  NEW_IDENTITY_ADDRESS = 'NEW_IDENTITY_ADDRESS',
  NEW_BITCOIN_ADDRESS = 'NEW_BITCOIN_ADDRESS',
  UPDATE_BACKUP_PHRASE = 'UPDATE_BACKUP_PHRASE',
  UPDATE_BALANCES = 'UPDATE_BALANCES',
  UPDATE_CORE_ADDRESS = 'UPDATE_CORE_ADDRESS',
  UPDATE_CORE_BALANCE = 'UPDATE_CORE_BALANCE',
  RESET_CORE_BALANCE_WITHDRAWAL = 'RESET_CORE_BALANCE_WITHDRAWAL',
  WITHDRAWING_CORE_BALANCE = 'WITHDRAWING_CORE_BALANCE',
  WITHDRAW_CORE_BALANCE_SUCCESS = 'WITHDRAW_CORE_BALANCE_SUCCESS',
  WITHDRAW_CORE_BALANCE_ERROR = 'WITHDRAW_CORE_BALANCE_ERROR',
  PROMPTED_FOR_EMAIL = 'PROMPTED_FOR_EMAIL'



function createAccount(encryptedBackupPhrase, masterKeychain) {
  const identityPrivateKeychain = getIdentityPrivateKeychain(masterKeychain)
  const bitcoinPrivateKeychain = getBitcoinPrivateKeychain(masterKeychain)

  const identityPublicKeychain = identityPrivateKeychain.keyPair
    .getPublicKeyBuffer().toString('hex')

  const bitcoinPublicKeychain = bitcoinPrivateKeychain.keyPair.getPublicKeyBuffer().toString('hex')
  const firstIdentityAddress = getIdentityAddress(masterKeychain)
  const firstBitcoinAddress = getBitcoinAddress(masterKeychain)

  const firstIdentityAddressNode = getIdentityAddressNode(masterKeychain)
  const firstIdentityKey = firstIdentityAddressNode.keyPair.d.toBuffer(32).toString('hex')
  const firstIdentityKeyID = firstIdentityAddressNode.keyPair.getPublicKeyBuffer().toString('hex')


  return {
    type: CREATE_ACCOUNT,
    encryptedBackupPhrase,
    identityPublicKeychain,
    bitcoinPublicKeychain,
    firstIdentityAddress,
    firstBitcoinAddress,
    firstIdentityKey,
    firstIdentityKeyID
  }
}

function updateCoreWalletAddress(coreWalletAddress) {
  return {
    type: UPDATE_CORE_ADDRESS,
    coreWalletAddress
  }
}

function updateCoreWalletBalance(coreWalletBalance) {
  return {
    type: UPDATE_CORE_BALANCE,
    coreWalletBalance
  }
}

function deleteAccount() {
  return {
    type: DELETE_ACCOUNT,
    encryptedBackupPhrase: null,
    accountCreated: false
  }
}

function updateBackupPhrase(encryptedBackupPhrase) {
  return {
    type: UPDATE_BACKUP_PHRASE,
    encryptedBackupPhrase
  }
}

function updateBalances(balances) {
  return {
    type: UPDATE_BALANCES,
    balances
  }
}

function resetCoreBalanceWithdrawal() {
  return {
    type: RESET_CORE_BALANCE_WITHDRAWAL
  }
}

function withdrawingCoreBalance(recipientAddress) {
  return {
    type: WITHDRAWING_CORE_BALANCE,
    recipientAddress
  }
}

function withdrawCoreBalanceSuccess() {
  return {
    type: WITHDRAW_CORE_BALANCE_SUCCESS
  }
}

function withdrawCoreBalanceError(error) {
  return {
    type: WITHDRAW_CORE_BALANCE_ERROR,
    error
  }
}

function promptedForEmail() {
  return {
    type: PROMPTED_FOR_EMAIL
  }
}

function emailKeychainBackup(email) {
  logger.debug(`emailKeychainBackup: ${email}`)
  return dispatch => {
    dispatch(promptedForEmail())
    const requestHeaders = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }

    const requestBody = {
      email,
      encryptedPortalKey: 'abc'
    }

    const options = {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody)
    }

    const emailBackupUrl = 'http://localhost:2888/backup'

    return fetch(emailBackupUrl, options)
    .then(() => {
      logger.debug(`emailKeychainBackup: backup sent to ${email}`)
    }, (error) => {
      logger.error('emailKeychainBackup: error backing up keychain', error)
    }).catch(error => {
      logger.error('emailKeychainBackup: error backing up keychain', error)
    })
  }
}

function skipEmailBackup() {
  logger.trace('skipEmailBackup')
  return dispatch => {
    dispatch(promptedForEmail())
  }
}

function refreshCoreWalletBalance(addressBalanceUrl, coreAPIPassword) {
  return dispatch => {
    const headers = {"Authorization": authorizationHeaderValue(coreAPIPassword) }
    fetch(addressBalanceUrl, { headers: headers })
    .then((response) => response.text())
    .then((responseText) => JSON.parse(responseText))
    .then((responseJson) => {
      const balance = responseJson.balance.bitcoin;
      dispatch(
        updateCoreWalletBalance(balance)
      )
    })
    .catch((error) => {
      logger.error('refreshCoreWalletBalance: error refreshing balance', error)
    })
  }
}

function getCoreWalletAddress(walletPaymentAddressUrl, coreAPIPassword) {
  return dispatch => {
    const headers = { 'Authorization': authorizationHeaderValue(coreAPIPassword) }
    fetch(walletPaymentAddressUrl, { headers })
    .then((response) => response.text())
    .then((responseText) => JSON.parse(responseText))
    .then((responseJson) => {
      const address = responseJson.address
      dispatch(
        updateCoreWalletAddress(address)
      )
    }).catch((error) => {
      logger.error('getCoreWalletAddress: error fetching address', error)
    })
  }
}

function resetCoreWithdrawal() {
  return dispatch => {
    dispatch(resetCoreBalanceWithdrawal())
  }
}

function withdrawBitcoinFromCoreWallet(coreWalletWithdrawUrl, recipientAddress, amount, coreAPIPassword) {
  return dispatch => {
    dispatch(withdrawingCoreBalance(recipientAddress, amount))
    const requestHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': authorizationHeaderValue(coreAPIPassword)
    }

    const requestBody = JSON.stringify({
      address: recipientAddress,
      min_confs: 0,
      amount: btcToSatoshis(amount)
    })

    fetch(coreWalletWithdrawUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: requestBody
    })
    .then((response) => response.text())
    .then((responseText) => JSON.parse(responseText))
    .then((responseJson) => {
      if (responseJson['error']) {
        dispatch(withdrawCoreBalanceError(responseJson['error']))
      } else {
        dispatch(withdrawCoreBalanceSuccess())
      }
    })
    .catch((error) => {
      logger.error('withdrawBitcoinFromCoreWallet:', error)
      dispatch(withdrawCoreBalanceError(error))
    })
  }
}


function refreshBalances(addressBalanceUrl, addresses) {
  return dispatch => {
    let results = []
    addresses.forEach((address) => {
      // fetch balances from https://explorer.blockstack.org/insight-api/addr/{address}/?noTxList=1
      // parse results from: {"addrStr":"1Fvoya7XMvzfpioQnzaskndL7YigwHDnRE","balance":0.02431567,"balanceSat":2431567,"totalReceived":38.82799913,"totalReceivedSat":3882799913,"totalSent":38.80368346,"totalSentSat":3880368346,"unconfirmedBalance":0,"unconfirmedBalanceSat":0,"unconfirmedTxApperances":0,"txApperances":2181}
      const url = addressBalanceUrl.replace('{address}', address)
      fetch(url).then((response) => response.text())
      .then((responseText) => JSON.parse(responseText))
      .then((responseJson) => {
        results.push({
          address,
          balance: responseJson['balance']
        })

        if (results.length >= addresses.length) {
          let balances = {}
          let total = 0.0

          for (let i = 0; i < results.length; i++) {
            let address = results[i]['address']
            if (!balances.hasOwnProperty(address)) {
              let balance = results[i]['balance']
              total = total + balance
              balances[address] = balance
            } else {
              console.warn(`Duplicate address ${address} in addresses array`)
            }
          }

          balances['total'] = total

          dispatch(
            updateBalances(balances)
          )
        }
      })
    })
    .catch((error) => {
      logger.error('refreshBalances: error', error)
    })
  }
}

function initializeWallet(password, backupPhrase, email = null) {
  return dispatch => {
    let masterKeychain
    if (backupPhrase && bip39.validateMnemonic(backupPhrase)) {
      const seed = bip39.mnemonicToSeed(backupPhrase)
      masterKeychain = HDNode.fromSeedBuffer(seed)
    } else {
      masterKeychain = HDNode.fromSeedBuffer(randomBytes(32))
      const privateKeyBuffer = masterKeychain.keyPair.d.toBuffer(32)
      const entropy = privateKeyBuffer.toString('hex')
      backupPhrase = bip39.entropyToMnemonic(entropy)
    }

    encrypt(new Buffer(backupPhrase), password, function (err, ciphertextBuffer) {
      const encryptedBackupPhrase = ciphertextBuffer.toString('hex')
      dispatch(
        createAccount(encryptedBackupPhrase, masterKeychain, email)
      )
    })
  }
}

function newIdentityAddress() {
  return {
    type: NEW_IDENTITY_ADDRESS
  }
}

function newBitcoinAddress() {
  return {
    type: NEW_BITCOIN_ADDRESS
  }
}


export const AccountActions = {
  createAccount,
  updateBackupPhrase,
  initializeWallet,
  newIdentityAddress,
  newBitcoinAddress,
  deleteAccount,
  refreshBalances,
  getCoreWalletAddress,
  refreshCoreWalletBalance,
  resetCoreWithdrawal,
  withdrawBitcoinFromCoreWallet,
  emailKeychainBackup,
  skipEmailBackup
}

const initialState = {
  accountCreated: false,
  promptedForEmail: false,
  encryptedBackupPhrase: null,
  identityAccount: {
    addresses: [],
    keypairs: []
  },
  bitcoinAccount: {
    addresses: [],
    balances: { total: 0.0 }
  },
  coreWallet: {
    address: null,
    balance: 0.0,
    withdrawal: {
      inProgress: false,
      error: null,
      recipient: null,
      success: false
    }
  }
}

export function AccountReducer(state = initialState, action) {
  switch (action.type) {
    case CREATE_ACCOUNT:
      return Object.assign({}, state, {
        accountCreated: true,
        encryptedBackupPhrase: action.encryptedBackupPhrase,
        identityAccount: {
          publicKeychain: action.identityPublicKeychain,
          addresses: [
            action.firstIdentityAddress
          ],
          keypairs: [
            { key: action.firstIdentityKey,
              keyID: action.firstIdentityKeyID,
              address: action.firstIdentityAddress }
          ],
          addressIndex: 0
        },
        bitcoinAccount: {
          publicKeychain: action.bitcoinPublicKeychain,
          addresses: [
            action.firstBitcoinAddress
          ],
          addressIndex: 0,
          balances: state.bitcoinAccount.balances
        }
      })
    case DELETE_ACCOUNT:
      return Object.assign({}, state, {
        accountCreated: false,
        encryptedBackupPhrase: null
      })
    case UPDATE_CORE_ADDRESS:
      return Object.assign({}, state, {
        coreWallet: Object.assign({}, state.coreWallet, {
          address: action.coreWalletAddress
        })
      })
    case UPDATE_CORE_BALANCE:
      return Object.assign({}, state, {
        coreWallet: Object.assign({}, state.coreWallet, {
          balance: action.coreWalletBalance
        })
      })
    case UPDATE_BACKUP_PHRASE:
      return Object.assign({}, state, {
        encryptedBackupPhrase: action.encryptedBackupPhrase
      })
    case NEW_IDENTITY_ADDRESS:
      return Object.assign({}, state, {
        identityAccount: {
          publicKeychain: state.identityAccount.publicKeychain,
          addresses: [
            ...state.identityAccount.addresses,
            new PublicKeychain(state.identityAccount.publicKeychain)
              .publiclyEnumeratedChild(state.identityAccount.addressIndex + 1)
              .address().toString()
          ],
          addressIndex: state.identityAccount.addressIndex + 1
        }
      })
    case NEW_BITCOIN_ADDRESS:
      return Object.assign({}, state, {
        bitcoinAccount: {
          publicKeychain: state.bitcoinAccount.publicKeychain,
          addresses: [
            ...state.bitcoinAccount.addresses,
            new PublicKeychain(state.bitcoinAccount.publicKeychain)
              .publiclyEnumeratedChild(state.bitcoinAccount.addressIndex + 1)
              .address().toString()
          ],
          addressIndex: state.bitcoinAccount.addressIndex + 1,
          balances: state.bitcoinAccount.balances
        }
      })
    case UPDATE_BALANCES:
      return Object.assign({}, state, {
        bitcoinAccount: {
          publicKeychain: state.bitcoinAccount.publicKeychain,
          addresses: state.bitcoinAccount.addresses,
          balances: action.balances
        }
      })
    case RESET_CORE_BALANCE_WITHDRAWAL:
      return Object.assign({}, state, {
        coreWallet: Object.assign({}, state.coreWallet, {
          withdrawal: {
            inProgress: false,
            error: null,
            success: false,
            recipientAddress: null
          }
        })
      })
    case WITHDRAWING_CORE_BALANCE:
      return Object.assign({}, state, {
        coreWallet: Object.assign({}, state.coreWallet, {
          withdrawal: {
            inProgress: true,
            error: null,
            success: false,
            recipientAddress: action.recipientAddress
          }
        })
      })
    case WITHDRAW_CORE_BALANCE_SUCCESS:
      return Object.assign({}, state, {
        coreWallet: Object.assign({}, state.coreWallet, {
          withdrawal: Object.assign({}, state.coreWallet.withdrawal, {
            inProgress: false,
            success: true
          })
        })
      })
    case WITHDRAW_CORE_BALANCE_ERROR:
      return Object.assign({}, state, {
        coreWallet: Object.assign({}, state.coreWallet, {
          withdrawal: Object.assign({}, state.coreWallet.withdrawal, {
            inProgress: false,
            success: false,
            error: action.error
          })
        })
      })
    case PROMPTED_FOR_EMAIL:
      return Object.assign({}, state, {
        promptedForEmail: true
      })
    default:
      return state
  }
}
