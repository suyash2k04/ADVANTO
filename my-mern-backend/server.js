const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 1002;

app.use(cors());
app.use(bodyParser.json());


mongoose.connect('mongodb+srv://Suyash2k04:9665399042@cluster0.m5dwc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');


const transactionSchema = new mongoose.Schema({
    id: Number,
    title: String,
    price: Number,
    description: String,
    category: String,
    image: String,
    sold: Boolean,
    dateOfSale: Date,
});

const Transaction = mongoose.model('Transaction', transactionSchema);


const initializeDatabase = async () => {
    try {
        const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
        const transactions = response.data;

        // Clear existing data
        await Transaction.deleteMany({});
        
        // Insert new data
        await Transaction.insertMany(transactions);
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};


initializeDatabase();


app.get('/api/transactions', async (req, res) => {
    const { page = 1, perPage = 10, search = '' } = req.query;

    const query = {
        $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
        ],
    };


    if (search && !isNaN(search)) {
        query.$or.push({ price: Number(search) });
    }

    try {
        const transactions = await Transaction.find(query)
            .skip((page - 1) * perPage)
            .limit(Number(perPage));
        const total = await Transaction.countDocuments(query);
        
        res.json({ total, transactions });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ message: 'Error fetching transactions' });
    }
});


app.get('/api/statistics', async (req, res) => {
    const { month } = req.query;

    if (!month || month < 1 || month > 12) {
        return res.status(400).json({ message: 'Valid month is required (1-12)' });
    }

    try {
        const totalSales = await Transaction.aggregate([
            {
                $match: {
                    $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] },
                },
            },
            { $group: { _id: null, total: { $sum: "$price" }, count: { $sum: 1 } } },
        ]);

        const soldItems = await Transaction.countDocuments({
            $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] },
            sold: true
        });

        const notSoldItems = await Transaction.countDocuments({
            $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] },
            sold: false
        });

        res.json({
            totalSales: totalSales[0] ? totalSales[0].total : 0,
            totalSold: soldItems,
            totalNotSold: notSoldItems,
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ message: 'Error fetching statistics' });
    }
});


app.get('/api/bar-chart', async (req, res) => {
    const { month } = req.query;

    if (!month || month < 1 || month > 12) {
        return res.status(400).json({ message: 'Valid month is required (1-12)' });
    }

    try {
        const counts = await Promise.all([
            Transaction.countDocuments({ price: { $lt: 100 }, $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] }}),
            Transaction.countDocuments({ price: { $gte: 100, $lt: 200 }, $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] }}),
            Transaction.countDocuments({ price: { $gte: 200, $lt: 300 }, $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] }}),
            Transaction.countDocuments({ price: { $gte: 300, $lt: 400 }, $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] }}),
            Transaction.countDocuments({ price: { $gte: 400, $lt: 500 }, $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] }}),
            Transaction.countDocuments({ price: { $gte: 500, $lt: 600 }, $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] }}),
            Transaction.countDocuments({ price: { $gte: 600, $lt: 700 }, $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] }}),
            Transaction.countDocuments({ price: { $gte: 700, $lt: 800 }, $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] }}),
            Transaction.countDocuments({ price: { $gte: 800, $lt: 900 }, $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] }}),
            Transaction.countDocuments({ price: { $gte: 900 }, $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] }}),
        ]);

        res.json(counts);
    } catch (error) {
        console.error('Error fetching bar chart data:', error);
        res.status(500).json({ message: 'Error fetching bar chart data' });
    }
});


app.get('/api/pie-chart', async (req, res) => {
    const { month } = req.query;

    if (!month || month < 1 || month > 12) {
        return res.status(400).json({ message: 'Valid month is required (1-12)' });
    }

    try {
        const data = await Transaction.aggregate([
            {
                $match: {
                    $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] },
                },
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                },
            },
        ]);

        res.json(data);
    } catch (error) {
        console.error('Error fetching pie chart data:', error);
        res.status(500).json({ message: 'Error fetching pie chart data' });
    }
});


app.get('/api/combined-data', async (req, res) => {
    const { month } = req.query;

    if (!month || month < 1 || month > 12) {
        return res.status(400).json({ message: 'Valid month is required (1-12)' });
    }

    try {
        const [statistics, barChartData, pieChartData] = await Promise.all([
            Transaction.aggregate([
                {
                    $match: {
                        $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] },
                    },
                },
                { $group: { _id: null, total: { $sum: "$price" }, count: { $sum: 1 } } },
            ]),
            Transaction.aggregate([
                {
                    $match: {
                        $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] },
                    },
                },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                    },
                },
            ]),
            Promise.all([
                Transaction.countDocuments({ price: { $lt: 100 }, $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] }}),

            ]),
        ]);

        res.json({ statistics, barChartData, pieChartData });
    } catch (error) {
        console.error('Error fetching combined data:', error);
        res.status(500).json({ message: 'Error fetching combined data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
