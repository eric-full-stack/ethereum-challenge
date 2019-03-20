var express = require('express')
var cors = require('cors')
var Web3 = require('web3')
var util = require('util')
var fs = require('fs')
var bodyparser = require('body-parser')
var coder = require('qs')  
var CryptoJS = require('crypto-js')
const EthereumTx = require('ethereumjs-tx')
require('dotenv').config()

app = express()
app.use(cors())
app.use(bodyparser.json())
app.use(bodyparser.urlencoded({ 
	extended: true
}))

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", '*');
    res.header("Access-Control-Allow-Credentials", true);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header("Access-Control-Allow-Headers", 'Origin,X-Requested-With,Content-Type,Accept,content-type,application/json');
    next();
});

const ABI = require('./WordsList.json')
const WORDS_LIST_ADDRESS = process.env.ADDRESS
const web3 = new Web3(new Web3.providers.HttpProvider('https://ropsten.infura.io/v3/c81282a144ae4d26837984d149cbf724'))
const contract = new web3.eth.Contract(ABI, WORDS_LIST_ADDRESS)
const account = process.env.ACCOUNT

app.get('/counter', async (req, res, next) => {
	try{
		let counter = await contract.methods.countWords().call()
		res.json(counter)
	}catch(e){
		next(e)
	}
})

app.get('/account', async (req, res, next) => {
	try{
		res.json(account)
	}catch(e){
		next(e)
	}
})

app.get('/words', async (req, res, next) => {
	try{
		var words = []
		let counter = await contract.methods.countWords().call()
		for(var i = 1; i <= counter; i++){
			const word = await contract.methods.words(i).call()
			words.push({string: word.word, date: word.date})
		}
		res.json(words)
	}catch(e){
		next(e)
	}
})

app.get('/word', async (req, res, next) => {
	try{
		const timestamp = await contract.methods.getByDate(req.query.word).call()
		res.json(timestamp)
	}catch(err){
		next(err)
	}
})

app.post('/word', async (req, res, next) => {
	try{

		var privateKey = Buffer.from(process.env.PRIVATEKEY, 'hex')
		var nonce = 0;
		await web3.eth.getTransactionCount(account).then(count => {
			nonce = count
		})
		
		var gasPrice = 0
		await contract.methods.createWord(req.body.word).estimateGas({gas: 3000000}, function(error, gasAmount){
			if(gasAmount == 30000000)
				console.log('Method ran out of gas');
			gasPrice = gasAmount
		});  

		var gasLimitHex = web3.utils.toHex(gasPrice)   

		var encoded = web3.eth.abi.encodeFunctionCall({
			name: 'createWord',
			type: 'function',
			inputs: [{
				type: 'string',
				name: '_word'
			}],
			"constant":false,
			"payable":false,
			"stateMutability":"nonpayable",
		}, [req.body.word]);

		const rawTx = {
			nonce: web3.utils.toHex(nonce),
			to: WORDS_LIST_ADDRESS,
			data: encoded,
			value: web3.utils.toHex(0),
			gas: web3.utils.toHex(5500000),
			gasPrice: web3.utils.toHex(gasPrice),
			gasLimit: web3.utils.toHex(300000),
		}

		const tx = new EthereumTx(rawTx);
		tx.sign(privateKey);
		const serializedTx = tx.serialize();
		web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).on('receipt', result => {
			res.json({success:true})
		}).on('error', err=>{
			console.log(err)
			res.json({success:true})
		})
		.then(function(receipt){
			res.json({success:true})
		}).catch(err => {
			res.json({success:false})
		})
		
		
	}catch(e){
		next(e)
	}
})

var server = app.listen(process.env.PORT || 8080, function () {
  var port = server.address().port;
  util.log("Express is working on port " + port);
});