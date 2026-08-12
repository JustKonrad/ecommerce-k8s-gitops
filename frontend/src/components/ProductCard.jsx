import React from 'react';

function ProductCard({ product, onAddToCart }) {
  return (
    <div className="product-card">
      <div className="product-header">
        <h3>{product.name}</h3>
        <span className="category">{product.category}</span>
      </div>
      <p className="product-desc">{product.description}</p>
      <div className="product-footer">
        <span className="price">${product.price}</span>
        <button className="add-btn" onClick={() => onAddToCart(product)}>Add to Cart</button>
      </div>
    </div>
  );
}

export default ProductCard;
