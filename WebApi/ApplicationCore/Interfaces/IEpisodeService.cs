using ApplicationCore.DTOs.Episode;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Interfaces
{
    public interface IEpisodeService
    {
        Task<List<EpisodeResponse>> GetBySeriesAsync(int seriesId);
        Task<EpisodeResponse> UpdateAsync(int id, UpdateEpisodeRequest request);
        Task<IEnumerable<EpisodeTypeResponse>> GetTypesAsync();
        Task<IEnumerable<EpisodeResponse>> GetBySeriesPublicAsync(int seriesId);
    }
}
