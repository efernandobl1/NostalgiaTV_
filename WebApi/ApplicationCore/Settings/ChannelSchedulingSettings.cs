namespace ApplicationCore.Settings
{
    /// <summary>
    /// Reglas configurables para la generación aleatoria de la programación de canales.
    /// Se enlaza desde la sección "ChannelScheduling" de appsettings y puede sobre-
    /// escribirse por entorno (Docker) con variables ChannelScheduling__Xxx.
    /// </summary>
    public class ChannelSchedulingSettings
    {
        /// <summary>Ventana en horas durante la cual no se repite un mismo episodio.</summary>
        public int NoRepeatWindowHours { get; set; } = 24;

        /// <summary>Máximo de especiales por serie y por día.</summary>
        public int MaxSpecialsPerSeriesPerDay { get; set; } = 2;

        /// <summary>Máximo de especiales en total por día (todas las series).</summary>
        public int MaxSpecialsPerDay { get; set; } = 5;

        /// <summary>Máximo de películas por serie y por día.</summary>
        public int MaxMoviesPerSeriesPerDay { get; set; } = 2;

        /// <summary>Máximo de películas en total por día (todas las series).</summary>
        public int MaxMoviesPerDay { get; set; } = 2;
    }
}
