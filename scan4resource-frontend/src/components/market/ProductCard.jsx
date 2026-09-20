import { formatPrice } from '../../lib/format'
import { HeartIcon, PinIcon } from '../Icons'
import MaterialImage from '../MaterialImage'

export default function ProductCard({ listing, favourite, onToggle }) {
  return (
    <article className="product">
      <div className="product-media">
        <MaterialImage kind={listing.category} src={listing.image} alt={listing.name} className="product-img" />
        <button
          type="button"
          className={`heart${favourite ? ' is-on' : ''}`}
          onClick={() => onToggle(listing.id)}
          aria-pressed={favourite}
          aria-label={favourite ? `Remove ${listing.name} from favourites` : `Save ${listing.name} to favourites`}
        >
          <HeartIcon />
        </button>
      </div>
      <div className="product-body">
        <h3>{listing.name}</h3>
        <p className="product-sub">{listing.sub}</p>
        <p className="product-where">
          <PinIcon width={15} height={15} />
          {listing.city}, {Math.max(1, Math.round(listing.distanceKm))} km
        </p>
        <p className="product-price">
          {formatPrice(listing.price)} / {listing.priceUnit}
        </p>
      </div>
    </article>
  )
}
