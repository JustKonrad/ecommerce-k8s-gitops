const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const fetchProducts = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.minPrice) params.append('minPrice', filters.minPrice);
    if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
    const res = await fetch(`${API_URL}/api/products?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch (err) {
    console.error('Error:', err);
    throw err;
  }
};
