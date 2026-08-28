using ApplicationCore.DTOs.Channel;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Interfaces
{
    public interface IChannelService
    {
        Task<List<ChannelResponse>> GetAllAsync();
        Task<ChannelResponse> CreateAsync(ChannelRequest request);
        Task<ChannelResponse> UpdateAsync(int id, ChannelRequest request);
        Task<ChannelResponse> AssignSeriesAsync(int channelId, AssignSeriesRequest request);
    }
}
