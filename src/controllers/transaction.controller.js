const transactionModel = require('../models/transaction.model')
const ledgerModel = require("../models/ledger.model")
const accountModel = require("../models/account.model")
const emailService = require("../services/email.service")
const mongoose = require("mongoose")

/**
 * - Create a new transaction
 * THe 10-STEP Transfer Flow:
    * 1. Validate Request
    * 2. Validate Idempotency key
    * 3. Check Account Status
    * 4. Derive Sender balance from ledger
    * 5. Create Transaction (PENDING)
    * 6. Create DEBIT Ledger entry
    * 7. Create CREDIT Ledger entry
    * 8. Mark transaction Completed
    * 9. Commit MongoDB session
    * 10. Send Email Notification 
 */
async function createTransaction(req, res) {

    /**
     * 1. Validate Account
     */
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

    if(!fromAccount || !toAccount || !amount || !idempotencyKey){
        return res.status(400).json({
            message: "FromAccount, toAcount, amount and idempotencykey is needed"
        })
    }

    const fromUserAccount = await accountModel.findOne({
        _id: fromAccount
    })

    const toUserAccount = await accountModel.findOne({
        _id: toAccount
    })

    if(!fromUserAccount || !toUserAccount){
        return res.status(400).json({
            message: "Invalid fromAccount or toAccount"
        })
    }

    /**
     * 2. Validate Idempotency key
     */
    const isTransactionAlreadyExists = await transactionModel.findOne({
        idempotencyKey: idempotencyKey
    })

    if(isTransactionAlreadyExists){
        if(isTransactionAlreadyExists.status === "COMPLETED"){
            return res.statis(200).json({
                message: "Transaction already processed",
                transaction: isTransactionAlreadyExists
            })
        }

        if(isTransactionAlreadyExists.status === "PENDING"){
            return res.status(200).json({
                message: "Transaction is still processing"
            })
        }

        if(isTransactionAlreadyExists.status === "FAILED"){
            return res.status(500).json({
                message: "Transaction processing failed, please retry"
            })
        }

        if(isTransactionAlreadyExists.status === "REVERSED"){
            return res.status(500).json({
                message: "Transaction was reversed, please retry"
            })
        }
    }

    /**
     * 3. Check Account Status
     */
    if(fromUserAccount !== "ACTIVE" || toUserAccount !== "ACTIVE"){
        return res.json(400).json({
            message: "Both fromAccount and toAccount must be ACTIVE"
        })
    }

    /**
     * 4. Derive Sender balance from ledger
     */
    const balance = await fromUserAccount.getBalance();

    if(balance < amount){
        return res.status(400).json({
            message: `Insufficient balance. Current balance is ${balance}. Requested balance is ${amount}`
        })
    }

    /**
     * 5. Create Transaction (PENDING)
     */
    const session = await mongoose.startSession()
    session.startTransaction()

    const transaction = await transactionModel.create({
        fromAccount,
        toAccount,
        amount,
        idempotencyKey,
        status: "PENDING"
    }, {session})

    const debitLedgerEntry = await ledgerModel.create({
        account: fromAccount,
        amount: amount,
        transaction: transaction._id,
        type: "DEBIT"
    }, {session})

    const creditLedgerEntry = await ledgerModel.create({
        account: toAccount,
        amount: amount,
        transaction: transaction._id,
        type: "CREDIT"
    }, {session})

    transaction.status = "COMPLETED"
    await transaction.save({session})
    
    await session.commitTransaction()
    session.endSession()

    /**
     * 10. Send Email Notification 
     */
    await emailService.sendTransactionEmail(req.user.email, req.user.name, amount, toAccount)

    return res.status(201).json({
        message: "Transaction completed successfully",
        transaction: transaction
    })

}

module.exports = {createTransaction};