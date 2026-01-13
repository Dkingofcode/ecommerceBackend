const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Get all the products
router.get('/', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    }catch(error){
        res.status(500).json({ message: error.message });
    }
});

// Create a new product
router.post('/', async (req, res) => {
    const { name, price, description } = req.body;
    const product = new Product({ name, price, description });

    try {
        const newProduct = await product.save();
        res.status(201).json(newProduct);
    }catch(error){
      res.status(400).json({ message: error.message });
    }
});



// Update a product
router.put('/:id', async (req, res) => {
    const { name, price, description } = req.body;
    try{
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, { name, price, description }, { new: true });
        if (!updatedProduct){
            return res.status(400).json({ message: "Product does not exist" });
        }
        res.json(updatedProduct);
    }catch(error){
        res.status(400).json({ message: error.message });
    }
});



// Delete a product
router.delete('/:id', async (req, res) => {
    try{
        const deletedProduct = await Product.findByIdAndRemove(req.params.id);
        if (!deletedProduct){
            return res.status(404).json({ message: "Product not found "});
        }
        res.json({ message: "Product deleted" });
    }catch(error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

































