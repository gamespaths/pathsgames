export default function StoryCard({ story, onClick }) {
  return (
    <div className="pg-card pg-card--home story-netflix-card" onClick={() => onClick(story)}>
      <span className="story-card-badge">{story.category}</span>
      <div className="story-card-play-icon">
        <i className="fas fa-play" />
      </div>
      <img
        src={story.card?.imageUrl}
        alt={story.title}
        className="story-card-img"
        loading="lazy"
      />
      <div className="story-card-body">
        <h4 className="story-card-title">{story.title}</h4>
      </div>
    </div>
  )
}
