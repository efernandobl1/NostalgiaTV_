using ApplicationCore.DTOs.ChannelEra;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Interfaces
{
    public interface IChannelEraService
    {
        Task<List<ChannelEraResponse>> GetByChannelAsync(int channelId);
        Task<ChannelEraResponse> GetByIdAsync(int eraId);
        Task<ChannelEraResponse> CreateAsync(int channelId, ChannelEraRequest request);
        Task<ChannelEraResponse> UpdateAsync(int eraId, ChannelEraRequest request);
        Task DeleteAsync(int eraId);
        Task<ChannelEraResponse> AssignSeriesAsync(int eraId, AssignSeriesToEraRequest request);
    }
}
