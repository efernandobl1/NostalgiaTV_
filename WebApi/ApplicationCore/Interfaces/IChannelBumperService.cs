using ApplicationCore.DTOs.ChannelBumper;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Interfaces
{
    public interface IChannelBumperService
    {
        Task<List<ChannelBumperResponse>> GetByEraAsync(int eraId);
        Task<ChannelBumperResponse> GetByIdAsync(int bumperId);
        Task<ChannelBumperResponse> CreateAsync(int eraId, ChannelBumperRequest request);
        Task<ChannelBumperResponse> UpdateAsync(int bumperId, ChannelBumperRequest request);
        Task DeleteAsync(int bumperId);
        Task<ChannelBumperResponse?> GetRandomBumperAsync(int eraId);
        Task<List<ChannelBumperResponse>> ScanFolderAsync(int eraId);
    }
}
