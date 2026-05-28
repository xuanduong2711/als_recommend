using System;

namespace Core.Entities
{
    public class TrackingEventEntity
    {
        public Guid id { get; set; } = Guid.NewGuid();
        public Guid user_id { get; set; }
        public string event_type { get; set; } = null!;
        public Guid book_id { get; set; }
        public DateTime created_at { get; set; } = DateTime.UtcNow;
    }
}
