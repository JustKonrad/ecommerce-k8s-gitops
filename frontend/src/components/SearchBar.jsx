import React from 'react';

function SearchBar({ filters, onFilterChange }) {
  return (
    <aside className="search-bar">
      <h3>Search & Filter</h3>
      <div className="filter-group">
        <input type="text" placeholder="Search..." value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })} className="search-input" />
      </div>
      <div className="filter-group">
        <label>Category</label>
        <select value={filters.category} onChange={(e) => onFilterChange({ category: e.target.value })}>
          <option value="">All</option>
          <option value="Electronics">Electronics</option>
          <option value="Accessories">Accessories</option>
        </select>
      </div>
      <div className="filter-group">
        <label>Min Price: ${filters.minPrice || 0}</label>
        <input type="number" min="0" onChange={(e) => onFilterChange({ minPrice: e.target.value ? parseFloat(e.target.value) : null })} />
      </div>
      <div className="filter-group">
        <label>Max Price: ${filters.maxPrice || 2000}</label>
        <input type="number" min="0" onChange={(e) => onFilterChange({ maxPrice: e.target.value ? parseFloat(e.target.value) : null })} />
      </div>
    </aside>
  );
}

export default SearchBar;
