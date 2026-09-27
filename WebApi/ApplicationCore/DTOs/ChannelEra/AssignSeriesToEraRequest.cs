using System.Collections.Generic;

namespace ApplicationCore.DTOs.ChannelEra
{
    public class AssignSeriesToEraRequest
    {
        public List<int> SeriesIds { get; set; } = [];
        public Dictionary<int, List<int>> SeasonSelections { get; set; } = [];
    }
}
