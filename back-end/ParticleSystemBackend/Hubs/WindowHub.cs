using Microsoft.AspNetCore.SignalR;

namespace ParticleSystemBackend.Hubs
{
    public class WindowHub : Hub
    {
        public async Task SendCenterPosition(string id, decimal x, decimal y)
        {
            await Clients.All.SendAsync("ReceiveCenterPosition", id, x, y);
        }
    }
}
