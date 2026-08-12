import React, { useState, useEffect } from 'react';
import ProductList from './components/ProductList';
import SearchBar from './components/SearchBar';
import Cart from './components/Cart';
import { fetchProducts } from './services/api';
import './App.css';

function App() {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [filters, setFilters] = useState({ search: '', category: '', minPrice: null, maxPrice: null });

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { applyFilters(); }, [products, filters]);

  const loadProducts = async () => {
    try {
      const data = await fetchProducts();
      setProducts(data.products || []);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = products;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(search) || p.description.toLowerCase().includes(search));
    }
    if (filters.category) result = result.filter(p => p.category === filters.category);
    if (filters.minPrice) result = result.filter(p => p.price >= filters.minPrice);
    if (filters.maxPrice) result = result.filter(p => p.price <= filters.maxPrice);
    setFiltered(result);
  };

  const handleFilterChange = (newFilters) => setFilters(prev => ({ ...prev, ...newFilters }));

  const handleAddToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const handleRemoveFromCart = (productId) => setCart(cart.filter(item => item.id !== productId));

  const handleUpdateQuantity = (productId, quantity) => {
    if (quantity <= 0) handleRemoveFromCart(productId);
    else setCart(cart.map(item => item.id === productId ? { ...item, quantity } : item));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🛍️ E-Shop</h1>
          <button className="cart-btn" onClick={() => setShowCart(!showCart)}>🛒 Cart ({cart.length})</button>
        </div>
      </header>
      <main className="app-main">
        {showCart ? (
          <Cart items={cart} total={cartTotal} onRemove={handleRemoveFromCart} onUpdateQuantity={handleUpdateQuantity} onClose={() => setShowCart(false)} />
        ) : (
          <div className="shop">
            <SearchBar filters={filters} onFilterChange={handleFilterChange} />
            {loading ? (
              <div className="loading">Loading products...</div>
            ) : filtered.length === 0 ? (
              <div className="empty">No products found</div>
            ) : (
              <ProductList products={filtered} onAddToCart={handleAddToCart} />
            )}
          </div>
        )}
      </main>
      <footer className="app-footer"><p>Built with React & Node.js</p></footer>
    </div>
  );
}

export default App;
