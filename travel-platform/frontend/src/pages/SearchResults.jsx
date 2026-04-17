import React, { useMemo, useState } from 'react';

export default function SearchResults({ search, results, onSearch, onOpenPackage }) {
  const [sortBy, setSortBy] = useState('recommended');

  const sortedResults = useMemo(() => {
    const items = [...results];
    if (sortBy === 'priceAsc') {
      items.sort((a, b) => a.pricePerPerson - b.pricePerPerson);
    } else if (sortBy === 'ratingDesc') {
      items.sort((a, b) => b.rating - a.rating);
    }
    return items;
  }, [results, sortBy]);

  return (
    <div className="page-stack">
      <section className="section-card compact">
        <div className="section-heading split">
          <div>
            <p className="eyebrow">Search results</p>
            <h3>{search.destination || 'ALL Region'} Recommended TRAVELProduct</h3>
            <p>{search.travelers} travelers, Travel options matching your criteria.</p>
          </div>
          <div className="toolbar">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="recommended">Recommended</option>
              <option value="priceAsc">Lowest price</option>
              <option value="ratingDesc">Highest rating</option>
            </select>
            <button className="ghost-btn" onClick={() => onSearch(search)}>Refresh</button>
          </div>
        </div>
      </section>

      <section className="results-layout">
        <aside className="filter-panel section-card compact">
          <p className="eyebrow">Criteria Summary</p>
          <ul className="summary-list">
            <li><span>Destination</span><strong>{search.destination || 'ALL'}</strong></li>
            <li><span>Departure date</span><strong>{search.startDate || 'TBD'}</strong></li>
            <li><span>Arrival date</span><strong>{search.endDate || 'TBD'}</strong></li>
            <li><span>People</span><strong>{search.travelers}name</strong></li>
            <li><span>Budget</span><strong>{search.budget}</strong></li>
            <li><span>Category</span><strong>{search.category}</strong></li>
          </ul>
        </aside>

        <div className="results-column">
          {sortedResults.length? sortedResults.map((pkg) => (
            <article className="result-card" key={pkg.id}>
              <div className="result-copy">
                <div className="travel-card-top">
                  <span className="pill">{pkg.categoryLabel}</span>
                  <span className="rating">★ {pkg.rating}</span>
                </div>
                <h4>{pkg.title}</h4>
                <p>{pkg.summary}</p>
                <div className="result-highlights">
                  {pkg.highlights.slice(0, 3).map((item) => <span key={item}>{item}</span>)}
                </div>
              </div>
              <div className="result-side">
                <div className="meta-block">
                  <strong>₩ {pkg.pricePerPerson.toLocaleString()}</strong>
                  <span>1 Basis / {pkg.durationNights}N {pkg.durationDays}D</span>
                </div>
                <button className="primary-btn" onClick={() => onOpenPackage(pkg.id)}>Details OK</button>
              </div>
            </article>
          )) : <div className="section-card"><p className="empty-state">No search results.</p></div>}
        </div>
      </section>
    </div>
  );
}
