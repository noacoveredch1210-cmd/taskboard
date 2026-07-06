using System.Data;
using Dapper;

namespace TaskBoard.Server.Data
{
    public class DateOnlyTypeHandler : SqlMapper.TypeHandler<DateOnly>
    {
        public override void SetValue(IDbDataParameter parameter, DateOnly value)
        {
            parameter.Value = value.ToDateTime(TimeOnly.MinValue);
        }

        public override DateOnly Parse(object value)
        {
            // Npgsql は date 列を DateOnly で返す。DateTime で返る環境にも備える。
            return value switch
            {
                DateOnly d => d,
                DateTime dt => DateOnly.FromDateTime(dt),
                _ => throw new InvalidCastException(
                    $"date 列を DateOnly に変換できません: {value?.GetType().Name ?? "null"}"),
            };
        }
    }

    public class NullableDateOnlyTypeHandler : SqlMapper.TypeHandler<DateOnly?>
    {
        public override void SetValue(IDbDataParameter parameter, DateOnly? value)
        {
            parameter.Value = value.HasValue
                ? value.Value.ToDateTime(TimeOnly.MinValue)
                : DBNull.Value;
        }

        public override DateOnly? Parse(object value)
        {
            // Npgsql は date 列を DateOnly で返す。DateTime で返る環境にも備える。
            return value switch
            {
                DateOnly d => d,
                DateTime dt => DateOnly.FromDateTime(dt),
                _ => null,
            };
        }
    }
}