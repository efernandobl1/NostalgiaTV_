using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Channel
{
    public class AssignSeriesRequest
    {
        public List<int> SeriesIds { get; set; } = [];
    }
}
