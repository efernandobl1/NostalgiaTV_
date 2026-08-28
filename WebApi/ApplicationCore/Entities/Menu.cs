using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Entities
{
    public class Menu
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Caption { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public int? ParentId { get; set; }
        public bool IsVisible { get; set; }
        public int SortOrder { get; set; }

        public Menu? Parent { get; set; }
        public ICollection<Menu> Children { get; set; } = [];
        public ICollection<Rol> Roles { get; set; } = [];
    }
}
