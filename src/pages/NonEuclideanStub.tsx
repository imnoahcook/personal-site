import { Link } from 'react-router-dom'
import './NonEuclidean.css'

interface NonEuclideanStubProps {
  message?: string
  title: string
  source: string
}

export default function NonEuclideanStub({
  message,
  title,
  source,
}: NonEuclideanStubProps) {
  return (
    <div className="non-euclidean-page non-euclidean-hub">
      <div className="non-euclidean-ui non-euclidean-ui--hub">
        <p className="non-euclidean-title">{title.toUpperCase()}</p>
        <p className="non-euclidean-copy">
          {message ??
            'This demo is gated while the browser port is being stabilized.'}
        </p>
        <p className="non-euclidean-copy">Source reference: `{source}`</p>

        <div className="non-euclidean-links">
          <Link to="/non-euclidean">all demos</Link>
          <Link to="/non-euclidean/level2-3">level2(3)</Link>
        </div>
      </div>
    </div>
  )
}
