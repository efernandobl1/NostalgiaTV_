using Infrastructure.Contexts;
using Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace Infrastructure.BackgroundServices
{
    public class ScheduleInitializerService : IHostedService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<ScheduleInitializerService> _logger;

        public ScheduleInitializerService(IServiceScopeFactory scopeFactory, ILogger<ScheduleInitializerService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public Task StartAsync(CancellationToken cancellationToken)
        {
            // Fire and forget — no bloquea el startup
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();
                    var scheduleService = scope.ServiceProvider.GetRequiredService<ChannelScheduleService>();

                    var channels = await context.Channels.ToListAsync(cancellationToken);
                    _logger.LogInformation("Pre-generating schedule for {count} channels", channels.Count);

                    foreach (var channel in channels)
                    {
                        await scheduleService.EnsureScheduleGeneratedAsync(channel.Id, DateTime.UtcNow.AddHours(24));
                        _logger.LogInformation("Schedule ready for channel {id}", channel.Id);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error pre-generating schedules");
                }
            }, cancellationToken);

            return Task.CompletedTask;
        }

        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
